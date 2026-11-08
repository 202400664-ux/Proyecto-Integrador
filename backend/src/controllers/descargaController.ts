import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Descarga } from '../models/Descarga.js';
import { Gateway } from '../models/Gateway.js';
import { Pedido } from '../models/Pedido.js';
import { registrarAuditoria } from './auditoriaController.js';
import { reevaluarCola } from '../services/colaPrioridad.js';
import { registrarEvento } from '../services/eventos.js';

function transaccionesNoDisponibles(error: unknown): boolean {
  return error instanceof Error && /Transaction numbers are only allowed|transactions are not supported/i.test(error.message);
}

async function iniciarDescargaCompensable(req: Request): Promise<string> {
  const { pedidoId, gatewayId } = req.body;
  const usuario = req.usuario?.nombreCompleto || 'Sistema';
  const [gateway, pedido] = await Promise.all([
    Gateway.findOne({ _id: gatewayId, activo: true }),
    Pedido.findOne({ _id: pedidoId, activo: true }),
  ]);
  if (!gateway || !pedido) throw new Error('Pedido o gateway no encontrado');
  const cargaEsperada = gateway.numeroGateway === 5 ? 'construcción' : 'general';
  if (gateway.estado !== 'LIBRE' || String(gateway.pedidoAsignadoId) !== String(pedido._id) ||
      pedido.estado !== 'GATEWAY ASIGNADO' || String(pedido.gatewayId) !== String(gateway._id) ||
      pedido.tipoProducto !== cargaEsperada || gateway.tipoCargaPermitida !== cargaEsperada) {
    throw new Error('Pedido y gateway no tienen una asignación compatible y disponible');
  }

  const ocupado = await Gateway.findOneAndUpdate(
    { _id: gateway._id, estado: 'LIBRE', pedidoAsignadoId: pedido._id, activo: true },
    { $set: { estado: 'OCUPADO', usuarioActualizacion: usuario } },
    { returnDocument: 'after' }
  );
  if (!ocupado) throw new Error('El gateway dejó de estar disponible');

  let descargaId = '';
  try {
    const pedidoDescargando = await Pedido.findOneAndUpdate(
      { _id: pedido._id, estado: 'GATEWAY ASIGNADO', gatewayId: gateway._id, activo: true },
      { $set: { estado: 'DESCARGANDO', usuarioActualizacion: usuario } },
      { returnDocument: 'after' }
    );
    if (!pedidoDescargando) throw new Error('El pedido ya no está asignado a este gateway');

    const descarga = await Descarga.create({
      gatewayId: gateway._id,
      pedidoId: pedido._id,
      operadorId: new mongoose.Types.ObjectId(req.usuario?.id),
      fechaHoraInicio: new Date(),
      usuarioCreacion: usuario,
      usuarioActualizacion: usuario,
    });
    descargaId = String(descarga._id);
    await registrarEvento({
      usuarioId: String(req.usuario?.id),
      usuario,
      accion: 'DESCARGADA_INICIADA',
      pedidoId: String(pedido._id),
      detalles: { numeroPedido: pedido.numeroPedido, numeroGateway: gateway.numeroGateway },
    });
    await registrarAuditoria({ entidad: 'Descarga', accion: 'iniciar', detalle: `Inició descarga ${pedido.numeroPedido} en Gateway ${gateway.numeroGateway}`, usuario });
    return descargaId;
  } catch (error) {
    if (descargaId) await Descarga.updateOne({ _id: descargaId }, { $set: { activo: false, usuarioActualizacion: usuario } });
    await Pedido.updateOne({ _id: pedido._id, estado: 'DESCARGANDO' }, { $set: { estado: 'GATEWAY ASIGNADO', usuarioActualizacion: usuario } });
    await Gateway.updateOne({ _id: gateway._id, estado: 'OCUPADO', pedidoAsignadoId: pedido._id }, { $set: { estado: 'LIBRE', usuarioActualizacion: usuario } });
    throw error;
  }
}

export const listarDescargas = async (_req: Request, res: Response): Promise<void> => {
  try {
    const descargas = await Descarga.find({ activo: true, fechaHoraFin: { $exists: false } })
      .populate('pedidoId', 'numeroPedido tipoProducto estado')
      .populate('gatewayId', 'numeroGateway estado')
      .sort({ fechaHoraInicio: 1 });
    res.status(200).json({ descargas });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al consultar descargas activas', error });
  }
};

export const iniciarDescarga = async (req: Request, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  let descargaId = '';
  try {
    try {
      await session.withTransaction(async () => {
      const { pedidoId, gatewayId } = req.body;
      const gateway = await Gateway.findOne({ _id: gatewayId, activo: true }).session(session);
      const pedido = await Pedido.findOne({ _id: pedidoId, activo: true }).session(session);
      if (!gateway || !pedido) throw new Error('Pedido o gateway no encontrado');
      if (gateway.estado !== 'LIBRE' || String(gateway.pedidoAsignadoId) !== String(pedido._id)) {
        throw new Error('El gateway debe estar libre y asignado a este pedido');
      }
      if (pedido.estado !== 'GATEWAY ASIGNADO' || String(pedido.gatewayId) !== String(gateway._id)) {
        throw new Error('El pedido no tiene asignado este gateway');
      }
      const cargaEsperada = gateway.numeroGateway === 5 ? 'construcción' : 'general';
      if (pedido.tipoProducto !== cargaEsperada || gateway.tipoCargaPermitida !== cargaEsperada) {
        throw new Error(`Carga incompatible: Gateway ${gateway.numeroGateway} solo permite ${cargaEsperada}`);
      }

      const horaInicio = new Date();
      gateway.estado = 'OCUPADO';
      gateway.usuarioActualizacion = req.usuario?.nombreCompleto || 'Sistema';
      await gateway.save({ session });
      pedido.estado = 'DESCARGANDO';
      pedido.usuarioActualizacion = gateway.usuarioActualizacion;
      await pedido.save({ session });
      const [descarga] = await Descarga.create([{
        gatewayId: gateway._id,
        pedidoId: pedido._id,
        operadorId: new mongoose.Types.ObjectId(req.usuario?.id),
        fechaHoraInicio: horaInicio,
        usuarioCreacion: gateway.usuarioActualizacion,
        usuarioActualizacion: gateway.usuarioActualizacion,
      }], { session });
      descargaId = String(descarga._id);
      await registrarAuditoria({
        entidad: 'Descarga',
        accion: 'iniciar',
        detalle: `Inició descarga ${pedido.numeroPedido} en Gateway ${gateway.numeroGateway}`,
        usuario: gateway.usuarioActualizacion,
        session,
      });
      await registrarEvento({
        usuarioId: String(req.usuario?.id),
        usuario: gateway.usuarioActualizacion,
        accion: 'DESCARGADA_INICIADA',
        pedidoId: String(pedido._id),
        detalles: { numeroPedido: pedido.numeroPedido, numeroGateway: gateway.numeroGateway },
        session,
      });
      });
    } catch (error) {
      if (!transaccionesNoDisponibles(error)) throw error;
      descargaId = await iniciarDescargaCompensable(req);
    }
    const descarga = await Descarga.findById(descargaId).populate('pedidoId', 'numeroPedido estado').populate('gatewayId', 'numeroGateway estado');
    res.status(201).json({ mensaje: 'Descarga iniciada', descarga });
  } catch (error) {
    res.status(400).json({ mensaje: error instanceof Error ? error.message : 'No se pudo iniciar descarga' });
  } finally {
    await session.endSession();
  }
};

export const finalizarDescarga = async (req: Request, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  let descargaId = '';
  try {
    await session.withTransaction(async () => {
      const descargaIdSolicitada = req.body.descargasId ?? req.body.descargaId;
      const descarga = await Descarga.findOne({ _id: descargaIdSolicitada, activo: true, fechaHoraFin: { $exists: false } }).session(session);
      if (!descarga) throw new Error('Descarga activa no encontrada');
      const [gateway, pedido] = await Promise.all([
        Gateway.findById(descarga.gatewayId).session(session),
        Pedido.findById(descarga.pedidoId).session(session),
      ]);
      if (!gateway || !pedido || gateway.estado !== 'OCUPADO' || pedido.estado !== 'DESCARGANDO') {
        throw new Error('El gateway o pedido no está en estado de descarga');
      }

      const horaFin = new Date();
      descarga.fechaHoraFin = horaFin;
      descarga.duracionMinutos = Math.max(0, (horaFin.getTime() - descarga.fechaHoraInicio.getTime()) / 60000);
      descarga.usuarioActualizacion = req.usuario?.nombreCompleto || 'Sistema';
      await descarga.save({ session });
      pedido.estado = 'FINALIZADO';
      pedido.usuarioActualizacion = descarga.usuarioActualizacion;
      await pedido.save({ session });
      await registrarEvento({
        usuarioId: String(req.usuario?.id),
        usuario: descarga.usuarioActualizacion,
        accion: 'DESCARGA_FINALIZADA',
        pedidoId: String(pedido._id),
        detalles: {
          numeroPedido: pedido.numeroPedido,
          numeroGateway: gateway.numeroGateway,
          fechaHoraFin: horaFin.toISOString(),
          duracionMinutos: descarga.duracionMinutos,
        },
        session,
      });
      gateway.estado = 'LIBRE';
      gateway.pedidoAsignadoId = undefined;
      gateway.usuarioActualizacion = descarga.usuarioActualizacion;
      await gateway.save({ session });
      descargaId = String(descarga._id);
      await registrarAuditoria({
        entidad: 'Descarga',
        accion: 'finalizar',
        detalle: `Finalizó descarga ${pedido.numeroPedido} en Gateway ${gateway.numeroGateway}; duración ${descarga.duracionMinutos.toFixed(2)} minutos`,
        usuario: descarga.usuarioActualizacion,
        session,
      });
    });
    try {
      await reevaluarCola({
        id: String(req.usuario?.id),
        nombreCompleto: req.usuario?.nombreCompleto || 'Usuario autenticado',
      });
    } catch (error) {
      console.error('La descarga finalizó, pero no se pudo reevaluar la cola:', error);
      res.status(500).json({
        mensaje: 'La descarga finalizó correctamente, pero no se pudo reevaluar la cola. Reintente la reevaluación.',
        descargaFinalizada: true,
      });
      return;
    }
    const descarga = await Descarga.findById(descargaId).populate('pedidoId', 'numeroPedido estado').populate('gatewayId', 'numeroGateway estado');
    res.status(200).json({ mensaje: 'Descarga finalizada y gateway liberado', descarga });
  } catch (error) {
    if (transaccionesNoDisponibles(error)) {
      res.status(503).json({ mensaje: 'La finalización requiere MongoDB con replica set; no se modificó la descarga ni se liberó el gateway' });
      return;
    }
    res.status(400).json({ mensaje: error instanceof Error ? error.message : 'No se pudo finalizar descarga' });
  } finally {
    await session.endSession();
  }
};