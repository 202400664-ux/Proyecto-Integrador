import type { Request, Response } from 'express';
import { Descarga } from '../models/Descarga.js';
import { Gateway } from '../models/Gateway.js';
import { Parametro } from '../models/Parametro.js';
import { Pedido } from '../models/Pedido.js';

const DIAS_ANALISIS = 30;
const ZONA_HORARIA = 'America/El_Salvador';

function minutosHora(valor: string | undefined, porDefecto: number): number {
  if (!valor) return porDefecto;
  const texto = valor.trim();
  const formato = /^(\d{1,2}):([0-5]\d)$/.exec(texto);
  if (formato) {
    const horas = Number(formato[1]);
    const minutos = Number(formato[2]);
    return horas <= 24 && (horas < 24 || minutos === 0) ? horas * 60 + minutos : porDefecto;
  }
  const numerico = Number(texto);
  return Number.isFinite(numerico) && numerico >= 0 && numerico <= 24
    ? Math.round(numerico * 60)
    : porDefecto;
}

function minutosOperativos(inicio: Date, fin: Date, desdeMinuto: number, hastaMinuto: number): number {
  if (fin <= inicio || hastaMinuto <= desdeMinuto) return 0;
  let total = 0;
  const dia = new Date(inicio);
  dia.setHours(0, 0, 0, 0);
  while (dia < fin) {
    if (dia.getDay() !== 0) {
      const inicioTurno = new Date(dia);
      inicioTurno.setMinutes(desdeMinuto, 0, 0);
      const finTurno = new Date(dia);
      finTurno.setMinutes(hastaMinuto, 0, 0);
      total += Math.max(
        0,
        Math.min(fin.getTime(), finTurno.getTime()) - Math.max(inicio.getTime(), inicioTurno.getTime())
      ) / 60_000;
    }
    dia.setDate(dia.getDate() + 1);
  }
  return total;
}

function promedio(valores: number[]): number {
  return valores.length ? Number((valores.reduce((suma, valor) => suma + valor, 0) / valores.length).toFixed(2)) : 0;
}

export async function obtenerKpis(_req: Request, res: Response): Promise<void> {
  try {
    const ahora = new Date();
    const desde = new Date(ahora.getTime() - DIAS_ANALISIS * 24 * 60 * 60_000);
    const [descargas, gateways, parametros, cumplimiento, arribosDiarios, finalizacionesDiarias] = await Promise.all([
      Descarga.find({ activo: true })
        .select('gatewayId pedidoId fechaHoraInicio fechaHoraFin')
        .populate<{ pedidoId: { tipoProducto: string; fechaHoraLlegadaReal?: Date } | null }>(
          'pedidoId',
          'tipoProducto fechaHoraLlegadaReal'
        )
        .lean(),
      Gateway.find({ numeroGateway: { $gte: 1, $lte: 5 } }).sort({ numeroGateway: 1 }).lean(),
      Parametro.find({ clave: { $in: ['horario_inicio_operativo', 'horario_fin_operativo'] }, activo: true }).lean(),
      Pedido.aggregate<{ _id: string; total: number }>([
        { $match: { activo: { $ne: false }, estado: { $ne: 'CANCELADO' } } },
        {
          $project: {
            categoria: { $ifNull: ['$clasificacionPuntualidad', '$estado'] },
          },
        },
        { $match: { categoria: { $in: ['A TIEMPO', 'ANTICIPADO', 'TARDÍO', 'AUSENTE'] } } },
        { $group: { _id: '$categoria', total: { $sum: 1 } } },
      ]),
      Pedido.aggregate<{ _id: string; total: number }>([
        {
          $match: {
            activo: { $ne: false },
            estado: { $ne: 'CANCELADO' },
            fechaHoraLlegadaReal: { $type: 'date' },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$fechaHoraLlegadaReal', timezone: ZONA_HORARIA },
            },
            total: { $sum: 1 },
          },
        },
      ]),
      Descarga.aggregate<{ _id: string; total: number }>([
        { $match: { activo: true, fechaHoraFin: { $type: 'date' } } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$fechaHoraFin', timezone: ZONA_HORARIA },
            },
            total: { $sum: 1 },
          },
        },
      ]),
    ]);

    const minutosEspera: number[] = [];
    const descargasGenerales: number[] = [];
    const descargasConstruccion: number[] = [];
    for (const descarga of descargas) {
      const pedido = descarga.pedidoId;
      if (pedido && pedido.fechaHoraLlegadaReal) {
        const espera = (new Date(descarga.fechaHoraInicio).getTime() - new Date(pedido.fechaHoraLlegadaReal).getTime()) / 60_000;
        if (espera >= 0) minutosEspera.push(espera);
      }
      if (descarga.fechaHoraFin && pedido) {
        const fin = new Date(descarga.fechaHoraFin).getTime();
        const duracion = (fin - new Date(descarga.fechaHoraInicio).getTime()) / 60_000;
        if (duracion >= 0 && pedido.tipoProducto === 'general') descargasGenerales.push(duracion);
        if (duracion >= 0 && pedido.tipoProducto === 'construcción') descargasConstruccion.push(duracion);
      }
    }

    const conteosCumplimiento = new Map(cumplimiento.map(({ _id, total }) => [_id, total]));
    const totalArribos = [...conteosCumplimiento.values()].reduce((suma, cantidad) => suma + cantidad, 0);
    const nivelCumplimiento = Object.fromEntries(
      ['A TIEMPO', 'ANTICIPADO', 'TARDÍO', 'AUSENTE'].map((estado) => [
        estado,
        {
          cantidad: conteosCumplimiento.get(estado) ?? 0,
          porcentaje: totalArribos
            ? Number((((conteosCumplimiento.get(estado) ?? 0) / totalArribos) * 100).toFixed(2))
            : 0,
        },
      ])
    );

    const valoresHorario = new Map(parametros.map(({ clave, valor }) => [clave, valor]));
    let inicioTurno = minutosHora(valoresHorario.get('horario_inicio_operativo'), 7 * 60);
    let finTurno = minutosHora(valoresHorario.get('horario_fin_operativo'), 17 * 60);
    if (inicioTurno >= finTurno) {
      inicioTurno = 7 * 60;
      finTurno = 17 * 60;
    }
    const ocupacionPorGateway = gateways.map((gateway) => {
      const inicioPeriodo = gateway.fechaCreacion && gateway.fechaCreacion > desde ? gateway.fechaCreacion : desde;
      const disponible = minutosOperativos(inicioPeriodo, ahora, inicioTurno, finTurno);
      const ocupado = descargas.reduce((suma, descarga) => {
        if (String(descarga.gatewayId) !== String(gateway._id)) return suma;
        const inicio = new Date(descarga.fechaHoraInicio);
        const fin = descarga.fechaHoraFin ? new Date(descarga.fechaHoraFin) : ahora;
        return suma + minutosOperativos(
          inicio > inicioPeriodo ? inicio : inicioPeriodo,
          fin < ahora ? fin : ahora,
          inicioTurno,
          finTurno
        );
      }, 0);
      return {
        numeroGateway: gateway.numeroGateway,
        porcentaje: disponible ? Number((Math.min(100, (ocupado / disponible) * 100)).toFixed(2)) : 0,
        minutosOcupados: Number(ocupado.toFixed(2)),
        minutosOperativos: Number(disponible.toFixed(2)),
      };
    });

    const volumenPorDia = new Map<string, { atendidos: number; finalizados: number }>();
    for (const { _id, total } of arribosDiarios) volumenPorDia.set(_id, { atendidos: total, finalizados: 0 });
    for (const { _id, total } of finalizacionesDiarias) {
      const actual = volumenPorDia.get(_id) ?? { atendidos: 0, finalizados: 0 };
      actual.finalizados = total;
      volumenPorDia.set(_id, actual);
    }

    res.status(200).json({
      periodoOcupacionDias: DIAS_ANALISIS,
      tiempoPromedioEsperaMinutos: promedio(minutosEspera),
      tiempoPromedioDescargaMinutos: {
        general: promedio(descargasGenerales),
        construccion: promedio(descargasConstruccion),
      },
      nivelCumplimiento,
      ocupacionPorGateway,
      volumenDiario: [...volumenPorDia.entries()]
        .sort(([fechaA], [fechaB]) => fechaA.localeCompare(fechaB))
        .map(([fecha, cantidades]) => ({ fecha, ...cantidades })),
    });
  } catch (error) {
    console.error('Error al calcular los indicadores logísticos:', error);
    res.status(500).json({ mensaje: 'No se pudieron calcular los indicadores logísticos' });
  }
}
