import { Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { Pedido } from '../models/Pedido.js';
import { Proveedor } from '../models/Proveedor.js';
import { Parametro } from '../models/Parametro.js';
import { ContadorPedido } from '../models/ContadorPedido.js';
import { registrarAuditoria } from './auditoriaController.js';
import { marcarPedidosAusentes } from './llegadasController.js';

interface HorarioOperativo {
  inicio: number;
  fin: number;
}

const HORARIO_POR_DEFECTO: HorarioOperativo = { inicio: 7 * 60, fin: 17 * 60 };
const CLAVES_HORARIO = ['horario_inicio_operativo', 'horario_fin_operativo'] as const;

async function generarNumeroPedido(): Promise<string> {
  const parametro = await Parametro.findOne({ clave: 'numero_equipo', activo: true });
  const equipoConfigurado = parametro?.valor.trim();
  if (!equipoConfigurado || !/^\d{1,2}$/.test(equipoConfigurado)) {
    throw new Error('Configure el parámetro numero_equipo con un valor numérico de uno o dos dígitos');
  }

  const equipo = equipoConfigurado.padStart(2, '0');
  const prefijo = `PED-EQUI${equipo}-`;
  const existentes = await Pedido.countDocuments({ numeroPedido: { $regex: `^${prefijo}` } });
  const ultimoPedido = await Pedido.findOne({ numeroPedido: { $regex: new RegExp(`^${prefijo}[0-9]{9}$`) } })
    .sort({ numeroPedido: -1 })
    .select('numeroPedido');
  const ultimoCorrelativo = ultimoPedido ? Number(ultimoPedido.numeroPedido.slice(prefijo.length)) : 0;
  await ContadorPedido.updateOne(
    { equipo },
    { $max: { secuencia: Math.max(existentes, ultimoCorrelativo) }, $setOnInsert: { equipo } },
    { upsert: true }
  );
  const contador = await ContadorPedido.findOneAndUpdate(
    { equipo },
    { $inc: { secuencia: 1 } },
    { new: true }
  );
  if (!contador || contador.secuencia > 999999999) throw new Error('Se agotó la secuencia de pedidos del equipo');
  return `${prefijo}${String(contador.secuencia).padStart(9, '0')}`;
}

function minutosDesdeMedianoche(valor: string | undefined, porDefecto: number): number {
  if (!valor) return porDefecto;
  const texto = valor.trim();
  const formatoHora = /^(\d{1,2}):([0-5]\d)$/.exec(texto);
  if (formatoHora) {
    const hora = Number(formatoHora[1]);
    return hora <= 24 && (hora < 24 || Number(formatoHora[2]) === 0)
      ? hora * 60 + Number(formatoHora[2])
      : porDefecto;
  }

  const horaNumerica = Number(texto);
  return Number.isFinite(horaNumerica) && horaNumerica >= 0 && horaNumerica <= 24
    ? horaNumerica * 60
    : porDefecto;
}

async function obtenerHorarioOperativo(): Promise<HorarioOperativo> {
  const parametros = await Parametro.find({ clave: { $in: CLAVES_HORARIO }, activo: true });
  const valores = new Map(parametros.map((parametro) => [parametro.clave, parametro.valor]));
  const horario = {
    inicio: minutosDesdeMedianoche(valores.get('horario_inicio_operativo'), HORARIO_POR_DEFECTO.inicio),
    fin: minutosDesdeMedianoche(valores.get('horario_fin_operativo'), HORARIO_POR_DEFECTO.fin),
  };
  return horario.inicio < horario.fin ? horario : HORARIO_POR_DEFECTO;
}

const dentroDelHorarioOperativo = (inicio: Date, fin: Date, horario: HorarioOperativo): boolean => {
  const dia = inicio.getDay();
  if (dia === 0 || !Number.isFinite(inicio.getTime()) || !Number.isFinite(fin.getTime())) return false;

  // La ventana completa debe caer el mismo día y dentro del rango permitido
  if (fin.getDay() !== dia) return false;
  const horaInicio = inicio.getHours() * 60 + inicio.getMinutes();
  const horaFin = fin.getHours() * 60 + fin.getMinutes();
  return horaInicio >= horario.inicio && horaFin <= horario.fin;
};

// Genera hasta 3 ventanas alternativas de la misma duración en días operativos.
const generarAlternativas = async (
  inicioSolicitado: Date,
  duracionMinutos: number,
  horario: HorarioOperativo,
  excluirPedidoId?: string
): Promise<{ inicioVentana: Date; finVentana: Date }[]> => {
  const primerInicio = new Date(Math.max(inicioSolicitado.getTime(), Date.now()));
  const primerDia = new Date(primerInicio);
  primerDia.setHours(0, 0, 0, 0);
  const limiteBusqueda = new Date(primerDia);
  limiteBusqueda.setDate(limiteBusqueda.getDate() + 90);

  const duracionMs = duracionMinutos * 60 * 1000;
  const alternativas: { inicioVentana: Date; finVentana: Date }[] = [];
  if (duracionMs <= 0) return alternativas;

  const inicioBusqueda = new Date(primerInicio);
  inicioBusqueda.setHours(0, 0, 0, 0);
  const pedidosDelDia = await Pedido.find({
    activo: { $ne: false },
    estado: { $ne: 'CANCELADO' },
    inicioVentana: { $gte: inicioBusqueda, $lt: limiteBusqueda },
    ...(excluirPedidoId ? { _id: { $ne: excluirPedidoId } } : {}),
  }).sort({ inicioVentana: 1 });

  const pedidosPorDia = new Map<string, typeof pedidosDelDia>();
  for (const pedido of pedidosDelDia) {
    const fecha = new Date(pedido.inicioVentana);
    const clave = `${fecha.getFullYear()}-${fecha.getMonth()}-${fecha.getDate()}`;
    const delDia = pedidosPorDia.get(clave) ?? [];
    delDia.push(pedido);
    pedidosPorDia.set(clave, delDia);
  }

  for (let desplazamiento = 0; desplazamiento < 90 && alternativas.length < 3; desplazamiento += 1) {
    const fechaDia = new Date(primerDia);
    fechaDia.setDate(fechaDia.getDate() + desplazamiento);
    if (fechaDia.getDay() === 0) continue;

    const inicioDelDia = new Date(fechaDia);
    inicioDelDia.setHours(Math.floor(horario.inicio / 60), horario.inicio % 60, 0, 0);
    const finDelDia = new Date(fechaDia);
    finDelDia.setHours(Math.floor(horario.fin / 60), horario.fin % 60, 0, 0);
    if (duracionMs > finDelDia.getTime() - inicioDelDia.getTime()) continue;

    let cursor = desplazamiento === 0 && primerInicio > inicioDelDia
      ? new Date(primerInicio)
      : inicioDelDia;
    const clave = `${fechaDia.getFullYear()}-${fechaDia.getMonth()}-${fechaDia.getDate()}`;

    for (const pedido of pedidosPorDia.get(clave) ?? []) {
      const inicioPedido = new Date(pedido.inicioVentana);
      const finPedido = new Date(pedido.finVentana);

      while (cursor.getTime() + duracionMs <= inicioPedido.getTime() && alternativas.length < 3) {
        const finCandidato = new Date(cursor.getTime() + duracionMs);
        alternativas.push({ inicioVentana: new Date(cursor), finVentana: finCandidato });
        cursor = finCandidato;
      }

      if (finPedido > cursor) cursor = finPedido;
    }

    while (cursor.getTime() + duracionMs <= finDelDia.getTime() && alternativas.length < 3) {
      const finCandidato = new Date(cursor.getTime() + duracionMs);
      alternativas.push({ inicioVentana: new Date(cursor), finVentana: finCandidato });
      cursor = finCandidato;
    }
  }

  return alternativas;
};

export const crearPedido = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      proveedorId,
      tipoProducto,
      fechaHoraProgramada,
      inicioVentana,
      finVentana,
      duracionEstimadaMinutos,
    } = req.body;

    // Validación de campos requeridos
    if (!proveedorId || !tipoProducto || !fechaHoraProgramada || !inicioVentana || !finVentana || !duracionEstimadaMinutos) {
      res.status(400).json({ mensaje: 'Faltan campos obligatorios' });
      return;
    }

    if (!['construcción', 'general'].includes(tipoProducto)) {
      res.status(400).json({ mensaje: 'El tipo de producto debe ser "construcción" o "general"' });
      return;
    }

    const duracionMinutos = Number(duracionEstimadaMinutos);
    if (!Number.isFinite(duracionMinutos) || duracionMinutos <= 0) {
      res.status(400).json({ mensaje: 'La duración estimada debe ser mayor a cero' });
      return;
    }

    // --- RN-01: el proveedor debe existir y estar activo ---
    if (!isValidObjectId(proveedorId)) {
      res.status(400).json({ mensaje: 'El ID del proveedor no es válido' });
      return;
    }
    const proveedor = await Proveedor.findOne({ _id: proveedorId, activo: true, estado: 'activo' });
    if (!proveedor) {
      res.status(400).json({ mensaje: 'El proveedor indicado no existe o está inactivo' });
      return;
    }
    if (tipoProducto !== proveedor.categoria) {
      res.status(400).json({ mensaje: 'El tipo de producto debe coincidir con la categoría del proveedor' });
      return;
    }

    const inicio = new Date(inicioVentana);
    const fin = new Date(finVentana);

    if (fin <= inicio) {
      res.status(400).json({ mensaje: 'finVentana debe ser posterior a inicioVentana' });
      return;
    }

    // La duración real entre inicioVentana y finVentana debe coincidir
    // exactamente con duracionEstimadaMinutos — son 2 campos independientes
    // que el usuario podría llenar de forma inconsistente.
    const duracionRealMinutos = (fin.getTime() - inicio.getTime()) / 60000;
    if (duracionRealMinutos !== duracionMinutos) {
      res.status(400).json({
        mensaje: `La ventana (${duracionRealMinutos} min) no coincide con la duración estimada declarada (${duracionMinutos} min)`,
      });
      return;
    }

    const horario = await obtenerHorarioOperativo();
    // --- RN-02a: dentro del horario operativo ---
    if (!dentroDelHorarioOperativo(inicio, fin, horario)) {
      res.status(400).json({
        mensaje: 'La ventana solicitada está fuera del horario operativo del centro logístico',
      });
      return;
    }

    // --- RN-02b: sin solapamiento con otro pedido ya programado ---
    const pedidoEnConflicto = await Pedido.findOne({
      activo: { $ne: false },
      estado: { $ne: 'CANCELADO' },
      inicioVentana: { $lt: fin },
      finVentana: { $gt: inicio },
    });

    if (pedidoEnConflicto) {
      const alternativas = await generarAlternativas(inicio, duracionMinutos, horario);
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

    const numeroPedido = await generarNumeroPedido();

    const nuevoPedido = await Pedido.create({
      numeroPedido,
      proveedorId,
      tipoProducto,
      fechaHoraProgramada: new Date(fechaHoraProgramada),
      inicioVentana: inicio,
      finVentana: fin,
      duracionEstimadaMinutos: duracionMinutos,
      estado: 'PROGRAMADO',
      usuarioCreacion: req.usuarioAutenticado!.nombreCompleto,
      usuarioActualizacion: req.usuarioAutenticado!.nombreCompleto,
    });

    await registrarAuditoria({
      entidad: 'Pedido',
      accion: 'crear',
      detalle: `Se programó el pedido ${nuevoPedido.numeroPedido} con ventana ${inicio.toISOString()} - ${fin.toISOString()}`,
      usuario: req.usuarioAutenticado!.nombreCompleto,
    });

    res.status(201).json({
      mensaje: 'Pedido programado exitosamente',
      pedido: nuevoPedido,
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Configure el parámetro numero_equipo')) {
      res.status(503).json({ mensaje: error.message });
      return;
    }
    console.error('Error al programar pedido:', error);
    res.status(500).json({ mensaje: 'Error interno en el servidor', error });
  }
};

export const obtenerPedidos = async (req: Request, res: Response): Promise<void> => {
  try {
    await marcarPedidosAusentes(); // Revisa y marca AUSENTE antes de listar
    const pedidos = await Pedido.find({ activo: { $ne: false }, estado: { $ne: 'CANCELADO' } })
      .populate('proveedorId')
      .sort({ inicioVentana: 1 });
    res.status(200).json({ pedidos });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error interno en el servidor', error });
  }
};

export const actualizarPedido = async (req: Request, res: Response): Promise<void> => {
  try {
    const pedido = await Pedido.findOne({ _id: req.params.id, activo: { $ne: false }, estado: { $ne: 'CANCELADO' } });
    if (!pedido) {
      res.status(404).json({ mensaje: 'Pedido no encontrado o inactivo' });
      return;
    }
    if (pedido.fechaHoraLlegadaReal) {
      res.status(409).json({ mensaje: 'El pedido ya fue entregado y no se puede editar' });
      return;
    }

    const proveedorId = req.body.proveedorId ?? String(pedido.proveedorId);
    if (!isValidObjectId(proveedorId)) {
      res.status(400).json({ mensaje: 'El ID del proveedor no es válido' });
      return;
    }
    const proveedor = await Proveedor.findOne({ _id: proveedorId, activo: true, estado: 'activo' });
    if (!proveedor) {
      res.status(400).json({ mensaje: 'El proveedor indicado no existe o está inactivo' });
      return;
    }

    const tipoProducto = req.body.tipoProducto ?? pedido.tipoProducto;
    if (!['construcción', 'general'].includes(tipoProducto)) {
      res.status(400).json({ mensaje: 'El tipo de producto debe ser "construcción" o "general"' });
      return;
    }
    if (tipoProducto !== proveedor.categoria) {
      res.status(400).json({ mensaje: 'El tipo de producto debe coincidir con la categoría del proveedor' });
      return;
    }

    const inicio = req.body.inicioVentana !== undefined ? new Date(req.body.inicioVentana) : new Date(pedido.inicioVentana);
    const fin = req.body.finVentana !== undefined ? new Date(req.body.finVentana) : new Date(pedido.finVentana);
    const duracionMinutos = req.body.duracionEstimadaMinutos !== undefined
      ? Number(req.body.duracionEstimadaMinutos)
      : pedido.duracionEstimadaMinutos;

    if (!Number.isFinite(duracionMinutos) || duracionMinutos <= 0) {
      res.status(400).json({ mensaje: 'La duración estimada debe ser mayor a cero' });
      return;
    }
    if (!Number.isFinite(inicio.getTime()) || !Number.isFinite(fin.getTime()) || fin <= inicio) {
      res.status(400).json({ mensaje: 'finVentana debe ser posterior a inicioVentana' });
      return;
    }

    const duracionRealMinutos = (fin.getTime() - inicio.getTime()) / 60000;
    if (duracionRealMinutos !== duracionMinutos) {
      res.status(400).json({ mensaje: 'La ventana no coincide con la duración estimada declarada' });
      return;
    }

    const horario = await obtenerHorarioOperativo();
    if (!dentroDelHorarioOperativo(inicio, fin, horario)) {
      res.status(400).json({ mensaje: 'La ventana está fuera del horario operativo, de lunes a sábado' });
      return;
    }

    const pedidoEnConflicto = await Pedido.findOne({
      _id: { $ne: pedido._id },
      activo: { $ne: false },
      estado: { $ne: 'CANCELADO' },
      inicioVentana: { $lt: fin },
      finVentana: { $gt: inicio },
    });
    if (pedidoEnConflicto) {
      const alternativas = await generarAlternativas(inicio, duracionMinutos, horario, String(pedido._id));
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

    pedido.proveedorId = proveedor._id;
    pedido.tipoProducto = tipoProducto;
    pedido.inicioVentana = inicio;
    pedido.finVentana = fin;
    pedido.duracionEstimadaMinutos = duracionMinutos;
    pedido.fechaHoraProgramada = pedido.inicioVentana;
    pedido.usuarioActualizacion = req.usuarioAutenticado!.nombreCompleto;
    await pedido.save();

    await registrarAuditoria({
      entidad: 'Pedido',
      accion: 'actualizar',
      detalle: `Se reprogramó el pedido ${pedido.numeroPedido}`,
      usuario: req.usuarioAutenticado!.nombreCompleto,
    });
    res.status(200).json({ mensaje: 'Pedido actualizado correctamente', pedido });
  } catch (error) {
    res.status(400).json({ mensaje: 'No se pudo actualizar el pedido', error });
  }
};

export const cancelarPedido = async (req: Request, res: Response): Promise<void> => {
  try {
    const pedidoActual = await Pedido.findOne({ _id: req.params.id, activo: { $ne: false } });
    if (!pedidoActual) {
      res.status(404).json({ mensaje: 'Pedido no encontrado o ya cancelado' });
      return;
    }
    if (pedidoActual.fechaHoraLlegadaReal) {
      res.status(409).json({ mensaje: 'El pedido ya fue entregado y no se puede cancelar' });
      return;
    }

    const pedido = await Pedido.findOneAndUpdate(
      { _id: req.params.id, activo: { $ne: false } },
      { $set: { estado: 'CANCELADO', activo: false, usuarioActualizacion: req.usuarioAutenticado!.nombreCompleto } },
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
      usuario: req.usuarioAutenticado!.nombreCompleto,
    });
    res.status(200).json({ mensaje: 'Pedido cancelado correctamente', pedido });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al cancelar el pedido', error });
  }
};