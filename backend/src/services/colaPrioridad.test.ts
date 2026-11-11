import assert from 'node:assert/strict';
import test from 'node:test';
import { Types } from 'mongoose';
import { MaxHeapPedidos, calcularPrioridad } from './colaPrioridad.js';

const ahora = new Date('2026-10-01T12:00:00.000Z').getTime();

function pedido(numeroPedido: string, estado: 'TARDÍO' | 'A TIEMPO' | 'ANTICIPADO', esperaMinutos: number) {
  return {
    _id: new Types.ObjectId(),
    numeroPedido,
    tipoProducto: 'general' as const,
    estado,
    fechaHoraIngresoCola: new Date(ahora - esperaMinutos * 60_000),
  };
}

test('PU-11 MaxHeapPedidos prioriza puntualidad cuando el tiempo de espera es equivalente', () => {
  const heap = new MaxHeapPedidos(ahora);
  heap.push(pedido('ANT-1', 'ANTICIPADO', 0));
  heap.push(pedido('ATI-1', 'A TIEMPO', 0));
  heap.push(pedido('TAR-1', 'TARDÍO', 0));

  assert.equal(heap.pop()?.numeroPedido, 'ATI-1');
  assert.equal(heap.pop()?.numeroPedido, 'ANT-1');
  assert.equal(heap.pop()?.numeroPedido, 'TAR-1');
});

test('PU-12 MaxHeapPedidos: el aging puede promover un pedido que ha esperado más tiempo', () => {
  const heap = new MaxHeapPedidos(ahora);
  heap.push(pedido('ATI-RECIENTE', 'A TIEMPO', 0));
  heap.push(pedido('TAR-ESPERA', 'TARDÍO', 30));

  assert.equal(heap.pop()?.numeroPedido, 'TAR-ESPERA');
});

test('calcularPrioridad suma un punto por cada factor_aging_min en cola', () => {
  assert.equal(calcularPrioridad(pedido('A', 'ANTICIPADO', 20), ahora, 5), 6);
  assert.equal(calcularPrioridad(pedido('B', 'A TIEMPO', 9), ahora, 10), 3);
  assert.equal(calcularPrioridad(pedido('C', 'TARDÍO', 45), ahora, 10), 5);
});

test('MaxHeapPedidos desempata por la hora programada más antigua', () => {
  const heap = new MaxHeapPedidos(ahora);
  heap.push({ ...pedido('POSTERIOR', 'A TIEMPO', 0), fechaHoraProgramada: new Date(ahora + 60_000) });
  heap.push({ ...pedido('ANTERIOR', 'A TIEMPO', 0), fechaHoraProgramada: new Date(ahora - 60_000) });

  assert.equal(heap.pop()?.numeroPedido, 'ANTERIOR');
});