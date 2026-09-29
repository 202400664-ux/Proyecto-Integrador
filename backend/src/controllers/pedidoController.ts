import { Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { Pedido } from '../models/Pedido.js';
import { Proveedor } from '../models/Proveedor.js';
import { Parametro } from '../models/Parametro.js';
import { registrarAuditoria } from './auditoriaController.js';
import { marcarPedidosAusentes } from './llegadasController.js';
import { validarNombreCompleto } from '../utils/usuario.js';

interface HorarioOperativo {
  inicio: number;
  fin: number;
}

const convertirHora = (valor: string | undefined, defecto: number): number => {
  if (!valor || !/^([01]\d|2[0-3]):[0-5]\d$/.test(valor)) return defecto;
  const [horas, minutos] = valor.split(':').map(Number);
  return horas + minutos / 60;
};

async function obtenerHorarioOperativo(): Promise<HorarioOperativo> {
  const [apertura, cierre] = await Promise.all([
    Parametro.findOne({ clave: 'hora_apertura', activo: true }),
    Parametro.findOne({ clave: 'hora_cierre', activo: true }),
  ]);
  const horario = {
    inicio: convertirHora(apertura?.valor, 7),
    fin: convertirHora(cierre?.valor, 17),
  };
  return horario.inicio < horario.fin ? horario : { inicio: 7, fin: 17 };
}

const horaDecimal = (fecha: Date): number => fecha.getHours() + fecha.getMinutes() / 60;

const dentroDelHorarioOperativo = (inicio: Date, fin: Date, horario: HorarioOperativo): boolean => {
  const dia = inicio.getDay();
  if (dia === 0) return false;

  // La ventana completa debe caer el mismo día y dentro del rango permitido
  if (fin.getDay() !== dia) return false;
  return horaDecimal(inicio) >= horario.inicio && horaDecimal(fin) <= horario.fin;
};

// Revisa si dos ventanas de tiempo se traslapan
const seTraslapan = (inicioA: Date, finA: Date, inicioB: Date, finB: Date): boolean =>
  inicioA < finB && inicioB < finA;

// Genera hasta 3 ventanas alternativas disponibles, del mismo día y duración,
// probando espacios libres después de cada pedido ya ocupado ese día.
const generarAlternativas = async (
  inicioSolicitado: Date,
  duracionMinutos: number,
  horario: HorarioOperativo,
  excluirPedidoId?: string
): Promise<{ inicioVentana: Date; finVentana: Date }[]> => {
  const dia = inicioSolicitado.getDay();
  if (dia === 0 || duracionMinutos <= 0) return [];

  const inicioDelDia = new Date(inicioSolicitado);
  inicioDelDia.setHours(Math.floor(horario.inicio), (horario.inicio % 1) * 60, 0, 0);

  const finDelDia = new Date(inicioSolicitado);
  finDelDia.setHours(Math.floor(horario.fin), (horario.fin % 1) * 60, 0, 0);

  // Trae todos los pedidos activos de ese mismo día, ordenados por inicio
  const inicioBusqueda = new Date(inicioSolicitado);
  inicioBusqueda.setHours(0, 0, 0, 0);
  const finBusqueda = new Date(inicioSolicitado);
  finBusqueda.setHours(23, 59, 59, 999);

  const pedidosDelDia = await Pedido.find({
    activo: true,
    estado: { $ne: 'CANCELADO' },
    inicioVentana: { $lte: finBusqueda },
    finVentana: { $gte: inicioBusqueda },
    ...(excluirPedidoId ? { _id: { $ne: excluirPedidoId } } : {}),
  }).sort({ inicioVentana: 1 });

  const duracionMs = duracionMinutos * 60 * 1000;
  const alternativas: { inicioVentana: Date; finVentana: Date }[] = [];

  // Candidato 1: justo al abrir el centro ese día
  let cursor = new Date(inicioDelDia);

  for (const pedido of pedidosDelDia) {
    const finPedido = new Date(pedido.finVentana);
    const inicioPedido = new Date(pedido.inicioVentana);

    // ¿Cabe un espacio libre entre el cursor actual y el inicio de este pedido?
    while (cursor.getTime() + duracionMs <= inicioPedido.getTime() && alternativas.length < 3) {
      const finCandidato = new Date(cursor.getTime() + duracionMs);
      alternativas.push({ inicioVentana: new Date(cursor), finVentana: finCandidato });
      cursor = finCandidato;
    }
    if (alternativas.length >= 3) return alternativas;

    // Avanza el cursor al final de este pedido si es más tarde
    if (finPedido > cursor) cursor = new Date(finPedido);
  }

  // Después del último pedido del día, hasta el cierre
  while (cursor.getTime() + duracionMs <= finDelDia.getTime() && alternativas.length < 3) {
    const finCandidato = new Date(cursor.getTime() + duracionMs);
    alternativas.push({ inicioVentana: new Date(cursor), finVentana: finCandidato });
    cursor = finCandidato;
  }

  return alternativas;
};

export const crearPedido = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      numeroPedido,
      proveedorId,
      tipoProducto,
      fechaHoraProgramada,
      inicioVentana,
      finVentana,
      duracionEstimadaMinutos,
      usuarioCreacion,
    } = req.body;
    const nombreUsuario = validarNombreCompleto(usuarioCreacion);

    // Validación de campos requeridos
    if (!numeroPedido || !proveedorId || !tipoProducto || !fechaHoraProgramada || !inicioVentana || !finVentana || !duracionEstimadaMinutos || !nombreUsuario) {
      res.status(400).json({ mensaje: 'Faltan campos obligatorios o el nombre completo del usuario' });
      return;
    }

    if (!['construcción', 'general'].includes(tipoProducto)) {
      res.status(400).json({ mensaje: 'El tipo de producto debe ser "construcción" o "general"' });
      return;
    }

    if (!isValidObjectId(proveedorId)) {
      res.status(400).json({ mensaje: 'proveedorId no tiene un formato válido' });
      return;
    }

    if (!Number.isFinite(Number(duracionEstimadaMinutos)) || Number(duracionEstimadaMinutos) <= 0) {
      res.status(400).json({ mensaje: 'La duración estimada debe ser mayor a cero' });
      return;
    }

    // --- RN-01: el proveedor debe existir y estar activo ---
    const proveedor = await Proveedor.findOne({ _id: proveedorId, activo: true });
    if (!proveedor) {
      res.status(404).json({ mensaje: 'El proveedor indicado no está registrado o está inactivo' });
      return;
    }

    const inicio = new Date(inicioVentana);
    const fin = new Date(finVentana);
    const fechaProgramada = new Date(fechaHoraProgramada);

    if (!Number.isFinite(fechaProgramada.getTime()) || !Number.isFinite(inicio.getTime()) || !Number.isFinite(fin.getTime()) || fin <= inicio) {
      res.status(400).json({ mensaje: 'finVentana debe ser posterior a inicioVentana' });
      return;
    }

    // La duración real entre inicioVentana y finVentana debe coincidir
    // exactamente con duracionEstimadaMinutos — son 2 campos independientes
    // que el usuario podría llenar de forma inconsistente.
    const duracionRealMinutos = (fin.getTime() - inicio.getTime()) / 60000;
    if (duracionRealMinutos !== Number(duracionEstimadaMinutos)) {
      res.status(400).json({
        mensaje: `La ventana (${duracionRealMinutos} min) no coincide con la duración estimada declarada (${duracionEstimadaMinutos} min)`,
      });
      return;
    }
    
    // --- RN-02a: dentro del horario operativo ---
    const horario = await obtenerHorarioOperativo();
    if (!dentroDelHorarioOperativo(inicio, fin, horario)) {
      res.status(400).json({
        mensaje: 'La ventana solicitada está fuera del horario operativo del centro logístico',
      });
      return;
    }

   // --- RN-02b: sin solapamiento con otro pedido ya programado ---
    const pedidoEnConflicto = await Pedido.findOne({
      activo: true,
      estado: { $ne: 'CANCELADO' },
      inicioVentana: { $lt: fin },
      finVentana: { $gt: inicio },
    });

    if (pedidoEnConflicto) {
      const alternativas = await generarAlternativas(inicio, Number(duracionEstimadaMinutos), horario);
      res.status(409).json({
        mensaje: 'La ventana solicitada se traslapa con otro pedido ya programado',
        conflictoCon: {
          numeroPedido: pedidoEnConflicto.numeroPedido,
          inicioVentana: pedidoEnConflicto.inicioVentana,
          finVentana: pedidoEnConflicto.finVentana,
        },
        ventanasAlternativas: alternativas,
      });
      return;
    }

    // Verifica unicidad de numeroPedido con mensaje claro (además del índice único)
    const yaExiste = await Pedido.findOne({ numeroPedido });
    if (yaExiste) {
      res.status(409).json({ mensaje: 'Ya existe un pedido con ese número' });
      return;
    }

    const nuevoPedido = await Pedido.create({
      numeroPedido,
      proveedorId,
      tipoProducto,
      fechaHoraProgramada: fechaProgramada,
      inicioVentana: inicio,
      finVentana: fin,
      duracionEstimadaMinutos,
      estado: 'PROGRAMADO',
      usuarioCreacion: nombreUsuario,
      usuarioActualizacion: nombreUsuario,
    });

    await registrarAuditoria({
      entidad: 'Pedido',
      accion: 'crear',
      detalle: `Se programó el pedido ${nuevoPedido.numeroPedido} con ventana ${inicio.toISOString()} - ${fin.toISOString()}`,
      usuario: nombreUsuario,
    });

    res.status(201).json({
      mensaje: 'Pedido programado exitosamente',
      pedido: nuevoPedido,
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error interno en el servidor', error });
  }
};

export const obtenerPedidos = async (req: Request, res: Response): Promise<void> => {
  try {
    await marcarPedidosAusentes(); // Revisa y marca AUSENTE antes de listar
    const pedidos = await Pedido.find({ activo: true }).populate('proveedorId').sort({ inicioVentana: 1 });
    res.status(200).json({ pedidos });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error interno en el servidor', error });
  }
};

export const actualizarPedido = async (req: Request, res: Response): Promise<void> => {
  try {
    const nombreUsuario = validarNombreCompleto(req.body.usuarioActualizacion);
    if (!nombreUsuario) {
      res.status(400).json({ mensaje: 'usuarioActualizacion debe incluir el nombre completo del usuario' });
      return;
    }
    const pedido = await Pedido.findOne({ _id: req.params.id, activo: true });
    if (!pedido) {
      res.status(404).json({ mensaje: 'Pedido no encontrado o inactivo' });
      return;
    }
    if (pedido.fechaHoraLlegadaReal) {
      res.status(409).json({ mensaje: 'El pedido ya fue entregado y no se puede editar' });
      return;
    }

    const { proveedorId, tipoProducto, inicioVentana, finVentana, duracionEstimadaMinutos } = req.body;
    if (proveedorId !== undefined) {
      const proveedor = await Proveedor.findOne({ _id: proveedorId, activo: true });
      if (!proveedor) {
        res.status(400).json({ mensaje: 'El proveedor indicado no existe o está inactivo' });
        return;
      }
      (pedido as any).proveedorId = proveedor._id;
    }
    if (tipoProducto !== undefined) {
      if (!['construcción', 'general'].includes(tipoProducto)) {
        res.status(400).json({ mensaje: 'El tipo de producto debe ser "construcción" o "general"' });
        return;
      }
      (pedido as any).tipoProducto = tipoProducto;
    }
    if (inicioVentana !== undefined) (pedido as any).inicioVentana = new Date(inicioVentana);
    if (finVentana !== undefined) (pedido as any).finVentana = new Date(finVentana);
    if (duracionEstimadaMinutos !== undefined) (pedido as any).duracionEstimadaMinutos = Number(duracionEstimadaMinutos);

    if (!Number.isFinite(pedido.inicioVentana.getTime()) || !Number.isFinite(pedido.finVentana.getTime()) || pedido.finVentana <= pedido.inicioVentana) {
      res.status(400).json({ mensaje: 'finVentana debe ser posterior a inicioVentana' });
      return;
    }
    const duracionRealMinutos = (pedido.finVentana.getTime() - pedido.inicioVentana.getTime()) / 60000;
    if (duracionRealMinutos !== Number(pedido.duracionEstimadaMinutos) || Number(pedido.duracionEstimadaMinutos) <= 0) {
      res.status(400).json({ mensaje: 'La duración debe coincidir con la ventana y ser mayor a cero' });
      return;
    }

    const horario = await obtenerHorarioOperativo();
    if (!dentroDelHorarioOperativo(pedido.inicioVentana, pedido.finVentana, horario)) {
      res.status(400).json({ mensaje: 'La ventana debe estar dentro del horario operativo configurado, de lunes a sábado' });
      return;
    }

    const pedidoEnConflicto = await Pedido.findOne({
      _id: { $ne: pedido._id },
      activo: true,
      estado: { $ne: 'CANCELADO' },
      inicioVentana: { $lt: pedido.finVentana },
      finVentana: { $gt: pedido.inicioVentana },
    });
    if (pedidoEnConflicto) {
      const alternativas = await generarAlternativas(
        pedido.inicioVentana,
        Number(pedido.duracionEstimadaMinutos),
        horario,
        String(pedido._id)
      );
      res.status(409).json({
        mensaje: 'La ventana solicitada se traslapa con otro pedido ya programado',
        conflictoCon: {
          numeroPedido: pedidoEnConflicto.numeroPedido,
          inicioVentana: pedidoEnConflicto.inicioVentana,
          finVentana: pedidoEnConflicto.finVentana,
        },
        ventanasAlternativas: alternativas,
      });
      return;
    }
    pedido.fechaHoraProgramada = pedido.inicioVentana;
    pedido.usuarioActualizacion = nombreUsuario;
    await pedido.save();

    await registrarAuditoria({
      entidad: 'Pedido',
      accion: 'actualizar',
      detalle: `Se reprogramó el pedido ${pedido.numeroPedido}`,
      usuario: String(pedido.usuarioActualizacion),
    });
    res.status(200).json({ mensaje: 'Pedido actualizado correctamente', pedido });
  } catch (error) {
    res.status(400).json({ mensaje: 'No se pudo actualizar el pedido', error });
  }
};

export const cancelarPedido = async (req: Request, res: Response): Promise<void> => {
  try {
    const nombreUsuario = validarNombreCompleto(req.body?.usuarioActualizacion);
    if (!nombreUsuario) {
      res.status(400).json({ mensaje: 'usuarioActualizacion debe incluir el nombre completo del usuario' });
      return;
    }
    const pedidoActual = await Pedido.findOne({ _id: req.params.id, activo: true });
    if (!pedidoActual) {
      res.status(404).json({ mensaje: 'Pedido no encontrado o ya cancelado' });
      return;
    }
    if (pedidoActual.fechaHoraLlegadaReal) {
      res.status(409).json({ mensaje: 'El pedido ya fue entregado y no se puede cancelar' });
      return;
    }

    const pedido = await Pedido.findOneAndUpdate(
      { _id: req.params.id, activo: true },
      { $set: { estado: 'CANCELADO', activo: false, usuarioActualizacion: nombreUsuario } },
      { new: true }
    );
    if (!pedido) {
      res.status(404).json({ mensaje: 'Pedido no encontrado o ya cancelado' });
      return;
    }
    await registrarAuditoria({
      entidad: 'Pedido',
      accion: 'cancelar',
      detalle: `Se canceló lógicamente el pedido ${pedido.numeroPedido}`,
      usuario: String(pedido.usuarioActualizacion),
    });
    res.status(200).json({ mensaje: 'Pedido cancelado correctamente', pedido });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al cancelar el pedido', error });
  }
};