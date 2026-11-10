import { Types } from 'mongoose';
import { Gateway } from '../models/Gateway.js';
import { Parametro } from '../models/Parametro.js';
import { Pedido, type EstadoPedido, type TipoProducto } from '../models/Pedido.js';
import { Proveedor } from '../models/Proveedor.js';
import { registrarAuditoria } from '../controllers/auditoriaController.js';
import { notificarRol } from './notificaciones.js';
import { registrarEvento } from './eventos.js';
import { validarCompatibilidadBahia } from './reglasNegocio.js';

export interface ActorOperativo {
  id: string;
  nombreCompleto: string;
}

interface PedidoEnCola {
  _id: Types.ObjectId;
  numeroPedido: string;
  tipoProducto: TipoProducto;
  estado: EstadoPedido;
  clasificacionPuntualidad?: 'ANTICIPADO' | 'A TIEMPO' | 'TARDÍO';
  fechaHoraProgramada?: Date;
  fechaHoraIngresoCola?: Date;
  minutosEnEspera?: number;
  prioridadCalculada?: number;
}

const PRIORIDAD_PUNTUALIDAD: Partial<Record<EstadoPedido, number>> = {
  'A TIEMPO': 3,
  'ANTICIPADO': 2,
  'TARDÍO': 1,
};

export const FACTOR_AGING_POR_DEFECTO = 10;
export const LIMITE_ESPERA_POR_DEFECTO = 120;

export function calcularMinutosEnEspera(pedido: PedidoEnCola, ahora: number): number {
  const espera = ahora - new Date(pedido.fechaHoraIngresoCola ?? ahora).getTime();
  return Math.max(0, Math.floor(espera / 60_000));
}

/** Prioridad base por puntualidad + 1 punto por cada factor_aging_min transcurridos en cola. */
export function calcularPrioridad(pedido: PedidoEnCola, ahora: number, factorAgingMin: number): number {
  const base = PRIORIDAD_PUNTUALIDAD[pedido.clasificacionPuntualidad ?? pedido.estado] ?? 0;
  return base + Math.floor(calcularMinutosEnEspera(pedido, ahora) / factorAgingMin);
}

function precede(a: PedidoEnCola, b: PedidoEnCola, ahora: number, factorAgingMin: number): boolean {
  const diferencia = calcularPrioridad(a, ahora, factorAgingMin) - calcularPrioridad(b, ahora, factorAgingMin);
  if (diferencia !== 0) return diferencia > 0;
  const programada = new Date(a.fechaHoraProgramada ?? 0).getTime() - new Date(b.fechaHoraProgramada ?? 0).getTime();
  if (programada !== 0) return programada < 0;
  return new Date(a.fechaHoraIngresoCola ?? 0).getTime() < new Date(b.fechaHoraIngresoCola ?? 0).getTime();
}

export class MaxHeapPedidos {
  private elementos: PedidoEnCola[] = [];

  constructor(private readonly ahora = Date.now(), private readonly factorAgingMin = FACTOR_AGING_POR_DEFECTO) {}

  get size(): number { return this.elementos.length; }

  push(pedido: PedidoEnCola): void {
    this.elementos.push(pedido);
    let indice = this.elementos.length - 1;
    while (indice > 0) {
      const padre = Math.floor((indice - 1) / 2);
      if (!precede(this.elementos[indice], this.elementos[padre], this.ahora, this.factorAgingMin)) break;
      [this.elementos[indice], this.elementos[padre]] = [this.elementos[padre], this.elementos[indice]];
      indice = padre;
    }
  }

  pop(): PedidoEnCola | undefined {
    if (this.elementos.length === 0) return undefined;
    const primero = this.elementos[0];
    const ultimo = this.elementos.pop();
    if (this.elementos.length && ultimo) {
      this.elementos[0] = ultimo;
      let indice = 0;
      while (true) {
        const izquierdo = indice * 2 + 1;
        const derecho = izquierdo + 1;
        let mayor = indice;
        if (izquierdo < this.elementos.length && precede(this.elementos[izquierdo], this.elementos[mayor], this.ahora, this.factorAgingMin)) mayor = izquierdo;
        if (derecho < this.elementos.length && precede(this.elementos[derecho], this.elementos[mayor], this.ahora, this.factorAgingMin)) mayor = derecho;
        if (mayor === indice) break;
        [this.elementos[indice], this.elementos[mayor]] = [this.elementos[mayor], this.elementos[indice]];
        indice = mayor;
      }
    }
    return primero;
  }
}

/**
 * Recupera pedidos ANTICIPADO que no llegaron a encolarse durante el registro.
 * Conserva la clasificación original para que mantengan su prioridad.
 */
export async function incorporarAnticipados(actor: ActorOperativo, ahora = new Date()): Promise<number> {
  const pendientes = await Pedido.find({ activo: true, estado: 'ANTICIPADO' }).select('_id');
  let liberados = 0;
  for (const { _id } of pendientes) {
    // El filtro por estado evita liberar (y auditar) dos veces con peticiones simultáneas.
    const pedido = await Pedido.findOneAndUpdate(
      { _id, activo: true, estado: 'ANTICIPADO' },
      { $set: {
        estado: 'EN COLA',
        clasificacionPuntualidad: 'ANTICIPADO',
        fechaHoraIngresoCola: ahora,
        minutosEnEspera: 0,
        prioridadCalculada: PRIORIDAD_PUNTUALIDAD.ANTICIPADO,
        usuarioActualizacion: 'Motor EDA 0',
      } },
      { returnDocument: 'after' }
    );
    if (!pedido) continue;
    liberados += 1;
    await registrarEvento({
      usuarioId: actor.id,
      usuario: actor.nombreCompleto,
      accion: 'INGRESO_COLA',
      pedidoId: String(pedido._id),
      detalles: { numeroPedido: pedido.numeroPedido, clasificacionPuntualidad: 'ANTICIPADO', prioridadCalculada: pedido.prioridadCalculada, origen: 'reevaluación de cola' },
    });
  }
  return liberados;
}

async function leerParametroCola(clave: string, porDefecto: number): Promise<number> {
  const parametro = await Parametro.findOne({ clave, activo: true });
  const valor = Number(parametro?.valor);
  return Number.isFinite(valor) && valor >= 1 ? valor : porDefecto;
}

/**
 * Libera anticipados y persiste minutosEnEspera y prioridadCalculada de los
 * pedidos en cola; cada subida de prioridad por envejecimiento queda en eventos.
 */
async function sincronizarCola(actor: ActorOperativo) {
  await incorporarAnticipados(actor);
  const [factorAgingMin, limiteEsperaMax] = await Promise.all([
    leerParametroCola('factor_aging_min', FACTOR_AGING_POR_DEFECTO),
    leerParametroCola('limite_espera_max', LIMITE_ESPERA_POR_DEFECTO),
  ]);
  const pedidos = await Pedido.find({ activo: true, estado: 'EN COLA' })
    .populate({ path: 'proveedorId', model: Proveedor, select: 'razonSocial categoria' })
    .sort({ fechaHoraIngresoCola: 1 })
    .lean<PedidoEnCola[]>();
  const ahora = Date.now();

  for (const pedido of pedidos) {
    const minutosEnEspera = calcularMinutosEnEspera(pedido, ahora);
    const prioridadCalculada = calcularPrioridad(pedido, ahora, factorAgingMin);
    const prioridadAnterior = pedido.prioridadCalculada;
    if (minutosEnEspera === pedido.minutosEnEspera && prioridadCalculada === prioridadAnterior) continue;

    // Se condiciona a la prioridad leída para que solo una petición simultánea audite el cambio.
    const { modifiedCount } = await Pedido.updateOne(
      { _id: pedido._id, estado: 'EN COLA', prioridadCalculada: prioridadAnterior ?? null },
      { $set: { minutosEnEspera, prioridadCalculada } },
      { timestamps: false }
    );
    pedido.minutosEnEspera = minutosEnEspera;
    pedido.prioridadCalculada = prioridadCalculada;
    if (modifiedCount === 1 && prioridadAnterior !== undefined && prioridadCalculada > prioridadAnterior) {
      await registrarEvento({
        usuarioId: actor.id,
        usuario: actor.nombreCompleto,
        accion: 'AGING_APLICADO',
        pedidoId: String(pedido._id),
        detalles: { numeroPedido: pedido.numeroPedido, prioridadAnterior, prioridadCalculada, minutosEnEspera, factorAgingMin },
      });
    }
  }
  return { pedidos, ahora, factorAgingMin, limiteEsperaMax };
}

export async function reevaluarCola(actor: ActorOperativo): Promise<void> {
  const { pedidos, ahora, factorAgingMin } = await sincronizarCola(actor);
  if (!pedidos.length) return;

  const gateways = await Gateway.find({ activo: true, estado: 'LIBRE', pedidoAsignadoId: { $exists: false } })
    .sort({ numeroGateway: 1 });

  for (const gateway of gateways) {
    const heap = new MaxHeapPedidos(ahora, factorAgingMin);
    for (const pedido of pedidos) {
      if (validarCompatibilidadBahia(gateway, pedido.tipoProducto)) heap.push(pedido);
    }
    const candidato = heap.pop();
    if (!candidato) continue;

    const reserva = await Gateway.findOneAndUpdate(
      { _id: gateway._id, activo: true, estado: 'LIBRE', pedidoAsignadoId: { $exists: false } },
      { $set: { pedidoAsignadoId: candidato._id } },
      { returnDocument: 'after' }
    );
    if (!reserva) continue;

    const asignado = await Pedido.findOneAndUpdate(
      { _id: candidato._id, activo: true, estado: 'EN COLA' },
      { $set: { estado: 'GATEWAY ASIGNADO', gatewayId: gateway._id, usuarioActualizacion: 'Motor EDA 0' } },
      { returnDocument: 'after' }
    );
    if (!asignado) {
      await Gateway.updateOne({ _id: gateway._id, pedidoAsignadoId: candidato._id }, { $unset: { pedidoAsignadoId: 1 } });
      continue;
    }

    try {
      await registrarEvento({
        usuarioId: actor.id,
        usuario: actor.nombreCompleto,
        accion: 'PROMOCION_AUTOMATICA_GATEWAY',
        pedidoId: String(asignado._id),
        detalles: {
          numeroPedido: asignado.numeroPedido,
          numeroGateway: gateway.numeroGateway,
          prioridadCalculada: candidato.prioridadCalculada,
          minutosEnEspera: candidato.minutosEnEspera,
        },
      });
    } catch (error) {
      await Pedido.updateOne(
        { _id: asignado._id, estado: 'GATEWAY ASIGNADO', gatewayId: gateway._id },
        { $set: { estado: 'EN COLA', usuarioActualizacion: actor.nombreCompleto }, $unset: { gatewayId: 1 } }
      );
      await Gateway.updateOne(
        { _id: gateway._id, pedidoAsignadoId: asignado._id },
        { $unset: { pedidoAsignadoId: 1 } }
      );
      throw error;
    }

    const indice = pedidos.findIndex((pedido) => String(pedido._id) === String(candidato._id));
    if (indice >= 0) pedidos.splice(indice, 1);
    await registrarAuditoria({
      entidad: 'Gateway',
      accion: 'asignar',
      detalle: `Pedido ${asignado.numeroPedido} asignado al Gateway ${gateway.numeroGateway} por prioridad/aging`,
      usuario: 'Motor EDA 0',
    });
    await notificarRol(
      'operador',
      'Gateway asignado',
      `El pedido ${asignado.numeroPedido} fue asignado al Gateway ${gateway.numeroGateway}`,
      'Pedido',
      String(asignado._id)
    );
  }
}

export async function encolarPedido(pedidoId: string, actor: ActorOperativo): Promise<unknown> {
  const pedido = await Pedido.findOne({ _id: pedidoId, activo: true });
  if (!pedido) throw new Error('Pedido no encontrado o inactivo');
  if (!['ANTICIPADO', 'A TIEMPO', 'TARDÍO'].includes(pedido.estado)) {
    throw new Error('El pedido debe tener una llegada clasificada para entrar a la cola');
  }

  const estadoAnterior = pedido.estado;
  pedido.clasificacionPuntualidad = pedido.estado as 'ANTICIPADO' | 'A TIEMPO' | 'TARDÍO';
  pedido.fechaHoraIngresoCola = new Date();
  pedido.minutosEnEspera = 0;
  pedido.prioridadCalculada = PRIORIDAD_PUNTUALIDAD[pedido.clasificacionPuntualidad];
  pedido.estado = 'EN COLA';
  pedido.gatewayId = undefined;
  await pedido.save();
  try {
    await registrarEvento({
      usuarioId: actor.id,
      usuario: actor.nombreCompleto,
      accion: 'INGRESO_COLA',
      pedidoId: String(pedido._id),
      detalles: { numeroPedido: pedido.numeroPedido, clasificacionPuntualidad: pedido.clasificacionPuntualidad, prioridadCalculada: pedido.prioridadCalculada },
    });
  } catch (error) {
    pedido.estado = estadoAnterior;
    await pedido.save();
    throw error;
  }
  await registrarAuditoria({ entidad: 'Cola', accion: 'ingresar', detalle: `Pedido ${pedido.numeroPedido} ingresó a la cola`, usuario: actor.nombreCompleto });
  await reevaluarCola(actor);
  return Pedido.findById(pedido._id).populate('gatewayId');
}

export async function listarColaPrioridad(actor: ActorOperativo): Promise<Array<PedidoEnCola & { excedeLimiteEspera: boolean }>> {
  const { pedidos, ahora, factorAgingMin, limiteEsperaMax } = await sincronizarCola(actor);
  const heap = new MaxHeapPedidos(ahora, factorAgingMin);
  pedidos.forEach((pedido) => heap.push(pedido));
  const ordenados: Array<PedidoEnCola & { excedeLimiteEspera: boolean }> = [];
  while (heap.size) {
    const siguiente = heap.pop();
    if (siguiente) ordenados.push({ ...siguiente, excedeLimiteEspera: (siguiente.minutosEnEspera ?? 0) >= limiteEsperaMax });
  }
  return ordenados;
}