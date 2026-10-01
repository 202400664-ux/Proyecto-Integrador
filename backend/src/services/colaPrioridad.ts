import { Types } from 'mongoose';
import { Gateway } from '../models/Gateway.js';
import { Pedido, type EstadoPedido, type TipoProducto } from '../models/Pedido.js';
import { registrarAuditoria } from '../controllers/auditoriaController.js';
import { notificarRol } from './notificaciones.js';

interface PedidoEnCola {
  _id: Types.ObjectId;
  numeroPedido: string;
  tipoProducto: TipoProducto;
  estado: EstadoPedido;
  clasificacionPuntualidad?: 'ANTICIPADO' | 'A TIEMPO' | 'TARDÍO';
  fechaEntradaCola?: Date;
}

const PRIORIDAD_PUNTUALIDAD: Partial<Record<EstadoPedido, number>> = {
  'TARDÍO': 3,
  'A TIEMPO': 2,
  'ANTICIPADO': 1,
};

const INTERVALO_AGING_MINUTOS = Math.max(1, Number(process.env.AGING_INTERVALO_MINUTOS) || 10);

function puntuacion(pedido: PedidoEnCola, ahora: number): number {
  const base = PRIORIDAD_PUNTUALIDAD[pedido.clasificacionPuntualidad ?? pedido.estado] ?? 0;
  const espera = Math.max(0, ahora - new Date(pedido.fechaEntradaCola ?? ahora).getTime());
  return base + Math.floor(espera / (INTERVALO_AGING_MINUTOS * 60_000));
}

function precede(a: PedidoEnCola, b: PedidoEnCola, ahora: number): boolean {
  const diferencia = puntuacion(a, ahora) - puntuacion(b, ahora);
  if (diferencia !== 0) return diferencia > 0;
  return new Date(a.fechaEntradaCola ?? 0).getTime() < new Date(b.fechaEntradaCola ?? 0).getTime();
}

export class MaxHeapPedidos {
  private elementos: PedidoEnCola[] = [];

  constructor(private readonly ahora = Date.now()) {}

  get size(): number { return this.elementos.length; }

  push(pedido: PedidoEnCola): void {
    this.elementos.push(pedido);
    let indice = this.elementos.length - 1;
    while (indice > 0) {
      const padre = Math.floor((indice - 1) / 2);
      if (!precede(this.elementos[indice], this.elementos[padre], this.ahora)) break;
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
        if (izquierdo < this.elementos.length && precede(this.elementos[izquierdo], this.elementos[mayor], this.ahora)) mayor = izquierdo;
        if (derecho < this.elementos.length && precede(this.elementos[derecho], this.elementos[mayor], this.ahora)) mayor = derecho;
        if (mayor === indice) break;
        [this.elementos[indice], this.elementos[mayor]] = [this.elementos[mayor], this.elementos[indice]];
        indice = mayor;
      }
    }
    return primero;
  }
}

export async function reevaluarCola(): Promise<void> {
  const pedidos = await Pedido.find({ activo: true, estado: 'EN_COLA' })
    .sort({ fechaEntradaCola: 1 })
    .lean<PedidoEnCola[]>();
  if (!pedidos.length) return;

  const gateways = await Gateway.find({ activo: true, estado: 'LIBRE', pedidoAsignadoId: { $exists: false } })
    .sort({ numeroGateway: 1 });
  const ahora = Date.now();

  for (const gateway of gateways) {
    const heap = new MaxHeapPedidos(ahora);
    for (const pedido of pedidos) {
      const tipoCompatible = gateway.numeroGateway === 5
        ? pedido.tipoProducto === 'construcción'
        : pedido.tipoProducto === 'general';
      if (tipoCompatible) heap.push(pedido);
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
      { _id: candidato._id, activo: true, estado: 'EN_COLA' },
      { $set: { estado: 'GATEWAY_ASIGNADO', gatewayId: gateway._id, usuarioActualizacion: 'Motor EDA 0' } },
      { returnDocument: 'after' }
    );
    if (!asignado) {
      await Gateway.updateOne({ _id: gateway._id, pedidoAsignadoId: candidato._id }, { $unset: { pedidoAsignadoId: 1 } });
      continue;
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

export async function encolarPedido(pedidoId: string): Promise<unknown> {
  const pedido = await Pedido.findOne({ _id: pedidoId, activo: true });
  if (!pedido) throw new Error('Pedido no encontrado o inactivo');
  if (!['ANTICIPADO', 'A TIEMPO', 'TARDÍO'].includes(pedido.estado)) {
    throw new Error('El pedido debe tener una llegada clasificada para entrar a la cola');
  }

  pedido.clasificacionPuntualidad = pedido.estado as 'ANTICIPADO' | 'A TIEMPO' | 'TARDÍO';
  pedido.estado = 'EN_COLA';
  pedido.fechaEntradaCola = new Date();
  pedido.gatewayId = undefined;
  await pedido.save();
  await registrarAuditoria({ entidad: 'Cola', accion: 'ingresar', detalle: `Pedido ${pedido.numeroPedido} ingresó a la cola`, usuario: 'Motor EDA 0' });
  await reevaluarCola();
  return Pedido.findById(pedido._id).populate('gatewayId');
}

export async function listarColaPrioridad(): Promise<PedidoEnCola[]> {
  const pedidos = await Pedido.find({ activo: true, estado: 'EN_COLA' }).lean<PedidoEnCola[]>();
  const heap = new MaxHeapPedidos();
  pedidos.forEach((pedido) => heap.push(pedido));
  const ordenados: PedidoEnCola[] = [];
  while (heap.size) {
    const siguiente = heap.pop();
    if (siguiente) ordenados.push(siguiente);
  }
  return ordenados;
}