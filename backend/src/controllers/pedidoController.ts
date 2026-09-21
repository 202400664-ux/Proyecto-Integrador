import { Request, Response } from 'express';
import { Pedido } from '../models/Pedido.js';
import { Proveedor } from '../models/Proveedor.js';

// --- Configuración del horario operativo del centro de distribución ---
const HORARIO_OPERATIVO = {
  // 0 = domingo, 1 = lunes, ..., 6 = sábado
  1: { inicio: 6, fin: 18 },  // lunes: 6:00 - 18:00
  2: { inicio: 6, fin: 18 },  // martes
  3: { inicio: 6, fin: 18 },  // miércoles
  4: { inicio: 6, fin: 18 },  // jueves
  5: { inicio: 6, fin: 18 },  // viernes
  6: { inicio: 6, fin: 18 },  // sábado: 6:00 - 18:00
} as Record<number, { inicio: number; fin: number }>;
// domingo (0) no aparece = cerrado

const horaDecimal = (fecha: Date): number => fecha.getHours() + fecha.getMinutes() / 60;

const dentroDelHorarioOperativo = (inicio: Date, fin: Date): boolean => {
  const dia = inicio.getDay();
  const horario = HORARIO_OPERATIVO[dia];
  if (!horario) return false; // domingo, o cualquier día sin horario definido

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
  excluirPedidoId?: string
): Promise<{ inicioVentana: Date; finVentana: Date }[]> => {
  const dia = inicioSolicitado.getDay();
  const horario = HORARIO_OPERATIVO[dia];
  if (!horario) return [];

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
    estado: { $ne: 'CANCELADO' },
    inicioVentana: { $gte: inicioBusqueda, $lte: finBusqueda },
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
    if (cursor.getTime() + duracionMs <= inicioPedido.getTime()) {
      const finCandidato = new Date(cursor.getTime() + duracionMs);
      alternativas.push({ inicioVentana: new Date(cursor), finVentana: finCandidato });
      if (alternativas.length >= 3) return alternativas;
    }

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
    } = req.body;

    // Validación de campos requeridos
    if (!numeroPedido || !proveedorId || !tipoProducto || !fechaHoraProgramada || !inicioVentana || !finVentana || !duracionEstimadaMinutos) {
      res.status(400).json({ mensaje: 'Faltan campos obligatorios' });
      return;
    }

    if (!['construcción', 'general'].includes(tipoProducto)) {
      res.status(400).json({ mensaje: 'El tipo de producto debe ser "construcción" o "general"' });
      return;
    }

    if (duracionEstimadaMinutos <= 0) {
      res.status(400).json({ mensaje: 'La duración estimada debe ser mayor a cero' });
      return;
    }

    // --- RN-01: el proveedor debe existir ---
    const proveedor = await Proveedor.findById(proveedorId);
    if (!proveedor) {
      res.status(404).json({ mensaje: 'El proveedor indicado no está registrado' });
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
    if (duracionRealMinutos !== Number(duracionEstimadaMinutos)) {
      res.status(400).json({
        mensaje: `La ventana (${duracionRealMinutos} min) no coincide con la duración estimada declarada (${duracionEstimadaMinutos} min)`,
      });
      return;
    }
    
    // --- RN-02a: dentro del horario operativo ---
    if (!dentroDelHorarioOperativo(inicio, fin)) {
      res.status(400).json({
        mensaje: 'La ventana solicitada está fuera del horario operativo del centro logístico',
      });
      return;
    }

   // --- RN-02b: sin solapamiento con otro pedido ya programado ---
    const pedidosDelDia = await Pedido.find({
      estado: { $ne: 'CANCELADO' },
    });

    const pedidoEnConflicto = pedidosDelDia.find((pedido) =>
      seTraslapan(inicio, fin, new Date(pedido.inicioVentana), new Date(pedido.finVentana))
    );

    if (pedidoEnConflicto) {
      const alternativas = await generarAlternativas(inicio, duracionEstimadaMinutos);
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
      fechaHoraProgramada: new Date(fechaHoraProgramada),
      inicioVentana: inicio,
      finVentana: fin,
      duracionEstimadaMinutos,
      estado: 'PROGRAMADO',
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
    const pedidos = await Pedido.find().populate('proveedorId').sort({ inicioVentana: 1 });
    res.status(200).json({ pedidos });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error interno en el servidor', error });
  }
};