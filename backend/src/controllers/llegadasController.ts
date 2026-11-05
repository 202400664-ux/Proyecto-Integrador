import { Request, Response } from 'express';
import { Pedido } from '../models/Pedido.js';
import { Parametro } from '../models/Parametro.js';
import { registrarAuditoria } from './auditoriaController.js';
import { encolarPedido } from '../services/colaPrioridad.js';
import { registrarEvento } from '../services/eventos.js';
import { evaluarTolerancia, puedeIngresarACola, TOLERANCIAS_POR_DEFECTO } from '../services/reglasNegocio.js';

/** Lee un parámetro numérico de tolerancia; si no existe, usa el valor por defecto. */
async function obtenerToleranciaMinutos(clave: string, porDefecto: number): Promise<number> {
  const parametro = await Parametro.findOne({ clave, activo: true });
  if (!parametro) return porDefecto;
  const numero = Number(parametro.valor);
  return Number.isFinite(numero) ? numero : porDefecto;
}

export const registrarLlegada = async (req: Request, res: Response): Promise<void> => {
  try {
    const { numeroPedido } = req.body;
    const autenticado = req.usuarioAutenticado;
    if (!autenticado) {
      res.status(401).json({ mensaje: 'Se requiere una sesión autenticada' });
      return;
    }
    const actor = autenticado.nombreCompleto;

    const pedido = await Pedido.findOne({ numeroPedido, activo: { $ne: false }, estado: { $ne: 'CANCELADO' } });
    if (!pedido) {
      res.status(404).json({ mensaje: 'Pedido no encontrado o inactivo.' });
      return;
    }

    if (pedido.fechaHoraLlegadaReal) {
      res.status(400).json({
        mensaje: `Ya se registró la llegada del pedido ${pedido.numeroPedido}`,
      });
      return;
    }

    const estadoAnterior = pedido.estado;
    const clasificacionAnterior = pedido.clasificacionPuntualidad;
    const usuarioActualizacionAnterior = pedido.usuarioActualizacion;
    const fechaLlegadaReal = new Date();
    pedido.fechaHoraLlegadaReal = fechaLlegadaReal;

    // Tolerancias configurables desde la colección parametros (RN: comparar
    // contra parametros, no contra un valor fijo en el código).
    const toleranciaAnticipadoMin = await obtenerToleranciaMinutos('tolerancia_anticipado_minutos', TOLERANCIAS_POR_DEFECTO.anticipado);
    const toleranciaTardioMin = await obtenerToleranciaMinutos('tolerancia_tardio_minutos', TOLERANCIAS_POR_DEFECTO.tardio);

    // RN-04: la clasificación se delega a una función pura con pruebas unitarias.
    const nuevoEstado = evaluarTolerancia(
      fechaLlegadaReal,
      { inicioVentana: pedido.inicioVentana, finVentana: pedido.finVentana },
      { anticipado: toleranciaAnticipadoMin, tardio: toleranciaTardioMin }
    );

    pedido.estado = nuevoEstado;
    pedido.clasificacionPuntualidad = nuevoEstado;
    pedido.usuarioActualizacion = actor;
    await pedido.save();

    try {
      await registrarEvento({
        usuarioId: autenticado.id,
        usuario: actor,
        accion: 'LLEGADA_REGISTRADA',
        pedidoId: String(pedido._id),
        detalles: {
          numeroPedido: pedido.numeroPedido,
          fechaHoraLlegadaReal: fechaLlegadaReal.toISOString(),
          clasificacionPuntualidad: nuevoEstado,
        },
      });
    } catch (error) {
      pedido.fechaHoraLlegadaReal = undefined;
      pedido.estado = estadoAnterior;
      pedido.clasificacionPuntualidad = clasificacionAnterior;
      pedido.usuarioActualizacion = usuarioActualizacionAnterior;
      try {
        await pedido.save();
      } catch (rollbackError) {
        throw new AggregateError([error, rollbackError], 'No se pudo guardar el evento ni revertir el arribo');
      }
      throw error;
    }

    await registrarAuditoria({
      entidad: 'Llegada',
      accion: 'registrar',
      detalle: `Pedido ${pedido.numeroPedido} clasificado como ${nuevoEstado}. Ventana: ${new Date(pedido.inicioVentana).toISOString()} - ${new Date(pedido.finVentana).toISOString()}. Llegada real: ${fechaLlegadaReal.toISOString()}. Usuario: ${actor}`,
      usuario: actor,
    });

    let advertenciaCola: string | undefined;
    try {
      // HU-02 (escenario 2): un pedido ANTICIPADO espera en garita sin gateway
      // hasta que inicia su ventana; la cola lo libera en ese momento.
      if (puedeIngresarACola(nuevoEstado, pedido.inicioVentana, fechaLlegadaReal)) {
        await encolarPedido(String(pedido._id), { id: autenticado.id, nombreCompleto: actor });
      }
    } catch (error) {
      console.error('No se pudo procesar el pedido en la cola de gateways:', error);
      advertenciaCola = 'El arribo quedó registrado, pero no se pudo procesar la asignación automática en la cola.';
    }
    const pedidoActualizado = await Pedido.findById(pedido._id).populate('gatewayId');

    res.status(200).json({
      mensaje: 'Arribo registrado con éxito',
      estadoCalculado: nuevoEstado,
      pedido: pedidoActualizado,
      ...(advertenciaCola ? { advertencia: advertenciaCola } : {}),
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al registrar el arribo', error });
  }
};

/**
 * Marca como AUSENTE todo pedido PROGRAMADO cuya ventana ya cerró (más el
 * margen de tolerancia) sin que se haya registrado su llegada. Se ejecuta
 * de forma "perezosa" cada vez que se listan pedidos, en vez de requerir
 * un proceso en segundo plano (cron) separado.
 */
export async function marcarPedidosAusentes(): Promise<void> {
  const toleranciaAusenteMin = await obtenerToleranciaMinutos('tolerancia_ausente_minutos', TOLERANCIAS_POR_DEFECTO.ausente);
  const limite = new Date(Date.now() - toleranciaAusenteMin * 60000);

  await Pedido.updateMany(
    {
      activo: { $ne: false },
      estado: 'PROGRAMADO',
      $or: [
        { fechaHoraLlegadaReal: { $exists: false } },
        { fechaHoraLlegadaReal: null },
      ],
      finVentana: { $lte: limite },
    },
    {
      $set: { estado: 'AUSENTE', usuarioActualizacion: 'Sistema (auto)' },
    }
  );
}