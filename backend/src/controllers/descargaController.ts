import { Request, Response } from 'express';
import mongoose, { isValidObjectId } from 'mongoose';
import { Descarga } from '../models/Descarga.js';
import { Gateway } from '../models/Gateway.js';
import { Pedido } from '../models/Pedido.js';
import { registrarAuditoria } from './auditoriaController.js';

const ESTADOS_ELEGIBLES = ['EN COLA', 'ANTICIPADO', 'A TIEMPO', 'TARDÍO'];

export const obtenerDescargasActivas = async (_req: Request, res: Response): Promise<void> => {
  try {
    const descargas = await Descarga.find({ activo: true, fechaHoraFin: null })
      .populate('pedidoId', 'numeroPedido tipoProducto estado')
      .sort({ fechaHoraInicio: 1 });
    res.status(200).json({ descargas });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al consultar las descargas activas', error });
  }
};

export const iniciarDescarga = async (req: Request, res: Response): Promise<void> => {
  const { pedidoId, gatewayId } = req.body;
  if (!isValidObjectId(pedidoId) || !isValidObjectId(gatewayId)) {
    res.status(400).json({ mensaje: 'Los IDs de pedido y gateway deben ser válidos' });
    return;
  }

  const session = await mongoose.startSession();
  try {
    let descargaCreada;
    await session.withTransaction(async () => {
      const gateway = await Gateway.findOne({ _id: gatewayId, activo: true }).session(session);
      if (!gateway) throw new Error('Gateway no encontrado o inactivo');
      if (gateway.estado !== 'LIBRE') throw new Error('El gateway debe estar LIBRE para iniciar una descarga');

      const pedido = await Pedido.findOne({ _id: pedidoId, activo: { $ne: false } }).session(session);
      if (!pedido) throw new Error('Pedido no encontrado o inactivo');
      if (!ESTADOS_ELEGIBLES.includes(pedido.estado)) throw new Error('El pedido debe haber llegado y no estar descargado ni en proceso');
      if (gateway.tipoCargaPermitida !== pedido.tipoProducto) {
        throw new Error(`El Gateway ${gateway.numeroGateway} no admite carga de tipo ${pedido.tipoProducto}`);
      }

      const actor = req.usuarioAutenticado!.nombreCompleto;
      const gatewayActualizado = await Gateway.updateOne(
        { _id: gateway._id, estado: 'LIBRE', activo: true },
        { $set: { estado: 'OCUPADO', usuarioActualizacion: actor } },
        { session }
      );
      if (gatewayActualizado.modifiedCount !== 1) throw new Error('El gateway dejó de estar disponible; actualice e intente de nuevo');

      const pedidoActualizado = await Pedido.updateOne(
        { _id: pedido._id, estado: pedido.estado, activo: { $ne: false } },
        { $set: { estado: 'DESCARGANDO', usuarioActualizacion: actor } },
        { session }
      );
      if (pedidoActualizado.modifiedCount !== 1) throw new Error('El pedido cambió de estado; actualice e intente de nuevo');

      [descargaCreada] = await Descarga.create([{
        gatewayId: gateway._id,
        pedidoId: pedido._id,
        operadorId: req.usuarioAutenticado!.id,
        fechaHoraInicio: new Date(),
        usuarioCreacion: actor,
        usuarioActualizacion: actor,
      }], { session });
    });
    await registrarAuditoria({ entidad: 'Descarga', accion: 'iniciar', detalle: `Se inició la descarga del pedido ${pedidoId} en el Gateway ${gatewayId}`, usuario: req.usuarioAutenticado!.nombreCompleto });
    res.status(201).json({ mensaje: 'Descarga iniciada correctamente', descarga: descargaCreada });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'No se pudo iniciar la descarga';
    res.status(mensaje.includes('Transaction numbers') || mensaje.includes('replica set') ? 503 : 400)
      .json({ mensaje: mensaje.includes('Transaction numbers') || mensaje.includes('replica set') ? 'MongoDB debe ejecutarse como replica set para transacciones' : mensaje });
  } finally {
    await session.endSession();
  }
};

export const finalizarDescarga = async (req: Request, res: Response): Promise<void> => {
  const { descargaId } = req.body;
  if (!isValidObjectId(descargaId)) {
    res.status(400).json({ mensaje: 'El ID de la descarga no es válido' });
    return;
  }

  const session = await mongoose.startSession();
  try {
    let descargaFinalizada;
    await session.withTransaction(async () => {
      const descarga = await Descarga.findOne({ _id: descargaId, activo: true, fechaHoraFin: null }).session(session);
      if (!descarga) throw new Error('Descarga no encontrada o ya finalizada');
      const fechaHoraFin = new Date();
      const duracionMinutos = Math.max(0, Math.round((fechaHoraFin.getTime() - descarga.fechaHoraInicio.getTime()) / 60000));
      const actor = req.usuarioAutenticado!.nombreCompleto;

      const pedidoActualizado = await Pedido.updateOne(
        { _id: descarga.pedidoId, estado: 'DESCARGANDO', activo: { $ne: false } },
        { $set: { estado: 'FINALIZADO', usuarioActualizacion: actor } },
        { session }
      );
      if (pedidoActualizado.modifiedCount !== 1) throw new Error('El pedido asociado ya no está en estado DESCARGANDO');

      const gatewayActualizado = await Gateway.updateOne(
        { _id: descarga.gatewayId, estado: 'OCUPADO', activo: true },
        { $set: { estado: 'LIBRE', usuarioActualizacion: actor } },
        { session }
      );
      if (gatewayActualizado.modifiedCount !== 1) throw new Error('El gateway asociado ya no está ocupado');

      descarga.fechaHoraFin = fechaHoraFin;
      descarga.duracionMinutos = duracionMinutos;
      descarga.usuarioActualizacion = actor;
      descargaFinalizada = await descarga.save({ session });
    });
    await registrarAuditoria({ entidad: 'Descarga', accion: 'finalizar', detalle: `Se finalizó la descarga ${descargaId}`, usuario: req.usuarioAutenticado!.nombreCompleto });
    res.status(200).json({ mensaje: 'Descarga finalizada correctamente', descarga: descargaFinalizada });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'No se pudo finalizar la descarga';
    res.status(mensaje.includes('Transaction numbers') || mensaje.includes('replica set') ? 503 : 400)
      .json({ mensaje: mensaje.includes('Transaction numbers') || mensaje.includes('replica set') ? 'MongoDB debe ejecutarse como replica set para transacciones' : mensaje });
  } finally {
    await session.endSession();
  }
};