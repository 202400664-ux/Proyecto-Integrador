import { Request, Response } from 'express';
import { Pedido } from '../models/Pedido.js';
import { Proveedor } from '../models/Proveedor.js';
import { registrarAuditoria } from './auditoriaController.js';
import { marcarPedidosAusentes } from './llegadasController.js';

// --- Configuración del horario operativo del centro de distribución ---
const HORARIO_OPERATIVO = {
  // 0 = domingo, 1 = lunes, ..., 6 = sábado
  1: { inicio: 7, fin: 17 },  // lunes: 7:00 - 17:00
  2: { inicio: 7, fin: 17 },  // martes
  3: { inicio: 7, fin: 17 },  // miércoles
  4: { inicio: 7, fin: 17 },  // jueves
  5: { inicio: 7, fin: 17 },  // viernes
  6: { inicio: 7, fin: 17 },  // sábado: 7:00 - 17:00
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

// Genera hasta 3 ventanas alternativas de la misma duración en días operativos.
const generarAlternativas = async (
  inicioSolicitado: Date,
  duracionMinutos: number,
  excluirPedidoId?: string
): Promise<{ inicioVentana: Date; finVentana: Date }[]> => {
  const primerDia = new Date(inicioSolicitado);
  primerDia.setHours(0, 0, 0, 0);
  const limiteBusqueda = new Date(primerDia);
  limiteBusqueda.setDate(limiteBusqueda.getDate() + 90);

  const duracionMs = duracionMinutos * 60 * 1000;
  const alternativas: { inicioVentana: Date; finVentana: Date }[] = [];
  if (duracionMs <= 0) return alternativas;

  const inicioBusqueda = new Date(inicioSolicitado);
  inicioBusqueda.setHours(0, 0, 0, 0);
  const pedidosDelDia = await Pedido.find({
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
    const horario = HORARIO_OPERATIVO[fechaDia.getDay()];
    if (!horario) continue;

    const inicioDelDia = new Date(fechaDia);
    inicioDelDia.setHours(horario.inicio, 0, 0, 0);
    const finDelDia = new Date(fechaDia);
    finDelDia.setHours(horario.fin, 0, 0, 0);
    if (duracionMs > finDelDia.getTime() - inicioDelDia.getTime()) continue;

    let cursor = desplazamiento === 0 && inicioSolicitado > inicioDelDia
      ? new Date(inicioSolicitado)
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
      numeroPedido,
      proveedorId,
      tipoProducto,
      fechaHoraProgramada,
      inicioVentana,
      finVentana,
      duracionEstimadaMinutos,
      usuarioCreacion,
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
      usuarioCreacion: usuarioCreacion || 'Sistema',
      usuarioActualizacion: usuarioCreacion || 'Sistema',
    });

    await registrarAuditoria({
      entidad: 'Pedido',
      accion: 'crear',
      detalle: `Se programó el pedido ${nuevoPedido.numeroPedido} con ventana ${inicio.toISOString()} - ${fin.toISOString()}`,
      usuario: 'Sistema',
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
      const proveedor = await Proveedor.findById(proveedorId);
      if (!proveedor || !proveedor.activo) {
        res.status(400).json({ mensaje: 'El proveedor indicado no existe o está inactivo' });
        return;
      }
      (pedido as any).proveedorId = proveedor._id;
    }
    if (tipoProducto !== undefined) (pedido as any).tipoProducto = tipoProducto;
    if (inicioVentana !== undefined) (pedido as any).inicioVentana = new Date(inicioVentana);
    if (finVentana !== undefined) (pedido as any).finVentana = new Date(finVentana);
    if (duracionEstimadaMinutos !== undefined) (pedido as any).duracionEstimadaMinutos = Number(duracionEstimadaMinutos);

    if (pedido.finVentana <= pedido.inicioVentana) {
      res.status(400).json({ mensaje: 'finVentana debe ser posterior a inicioVentana' });
      return;
    }
    if (!dentroDelHorarioOperativo(pedido.inicioVentana, pedido.finVentana)) {
      res.status(400).json({ mensaje: 'La ventana debe estar entre 07:00 y 17:00, de lunes a sábado' });
      return;
    }
    pedido.fechaHoraProgramada = pedido.inicioVentana;
    pedido.usuarioActualizacion = req.body.usuarioActualizacion || 'Sistema';
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
      { $set: { estado: 'CANCELADO', activo: false, usuarioActualizacion: req.body?.usuarioActualizacion || 'Sistema' } },
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