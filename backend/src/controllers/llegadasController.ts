import { Request, Response } from 'express';
import { Pedido } from '../models/Pedido.js';
import { Parametro } from '../models/Parametro.js';
import { registrarAuditoria } from './auditoriaController.js';

/** Lee un parámetro numérico de tolerancia; si no existe, usa el valor por defecto. */
async function obtenerToleranciaMinutos(clave: string, porDefecto: number): Promise<number> {
  const parametro = await Parametro.findOne({ clave, activo: true });
  if (!parametro) return porDefecto;
  const numero = Number(parametro.valor);
  return Number.isFinite(numero) ? numero : porDefecto;
}

export const registrarLlegada = async (req: Request, res: Response): Promise<void> => {
  try {
    const { numeroPedido, usuarioNombre } = req.body;

    const pedido = await Pedido.findOne({ numeroPedido, activo: true });
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

    const fechaLlegadaReal = new Date();
    pedido.fechaHoraLlegadaReal = fechaLlegadaReal;

    // Tolerancias configurables desde la colección parametros (RN: comparar
    // contra parametros, no contra un valor fijo en el código).
    const toleranciaAnticipadoMin = await obtenerToleranciaMinutos('tolerancia_anticipado_minutos', 0);
    const toleranciaTardioMin = await obtenerToleranciaMinutos('tolerancia_tardio_minutos', 0);

    const inicioConTolerancia = new Date(pedido.inicioVentana).getTime() - toleranciaAnticipadoMin * 60000;
    const finConTolerancia = new Date(pedido.finVentana).getTime() + toleranciaTardioMin * 60000;
    const llegada = fechaLlegadaReal.getTime();

    let nuevoEstado: 'ANTICIPADO' | 'A TIEMPO' | 'TARDÍO' = 'A TIEMPO';
    if (llegada < inicioConTolerancia) {
      nuevoEstado = 'ANTICIPADO';
    } else if (llegada > finConTolerancia) {
      nuevoEstado = 'TARDÍO';
    }

    pedido.estado = nuevoEstado;
    pedido.usuarioActualizacion = usuarioNombre || 'Operador Caseta';
    await pedido.save();

    await registrarAuditoria({
      entidad: 'Llegada',
      accion: 'registrar',
      detalle: `Pedido ${pedido.numeroPedido} clasificado como ${nuevoEstado}. Ventana: ${new Date(pedido.inicioVentana).toISOString()} - ${new Date(pedido.finVentana).toISOString()}. Llegada real: ${fechaLlegadaReal.toISOString()}. Usuario: ${usuarioNombre || 'Operador Caseta'}`,
      usuario: usuarioNombre || 'Operador Caseta',
    });

    res.status(200).json({
      mensaje: 'Arribo registrado con éxito',
      estadoCalculado: nuevoEstado,
      pedido,
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
  const toleranciaAusenteMin = await obtenerToleranciaMinutos('tolerancia_ausente_minutos', 0);
  const limite = new Date(Date.now() - toleranciaAusenteMin * 60000);

  await Pedido.updateMany(
    {
      activo: true,
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