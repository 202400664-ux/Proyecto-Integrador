import assert from 'node:assert/strict';
import test from 'node:test';
import { Types } from 'mongoose';
import { MaxHeapPedidos } from './colaPrioridad.js';

const ahora = new Date('2026-10-01T12:00:00.000Z').getTime();

function pedido(numeroPedido: string, estado: 'TARDÍO' | 'A TIEMPO' | 'ANTICIPADO', esperaMinutos: number) {
  return {
    _id: new Types.ObjectId(),
    numeroPedido,
    tipoProducto: 'general' as const,
    estado,
    fechaEntradaCola: new Date(ahora - esperaMinutos * 60_000),
  };
}

test('PU-11 MaxHeapPedidos prioriza puntualidad cuando el tiempo de espera es equivalente', () => {
  const heap = new MaxHeapPedidos(ahora);
  heap.push(pedido('ANT-1', 'ANTICIPADO', 0));
  heap.push(pedido('ATI-1', 'A TIEMPO', 0));
  heap.push(pedido('TAR-1', 'TARDÍO', 0));

  assert.equal(heap.pop()?.numeroPedido, 'TAR-1');
  assert.equal(heap.pop()?.numeroPedido, 'ATI-1');
  assert.equal(heap.pop()?.numeroPedido, 'ANT-1');
});

test('PU-12 MaxHeapPedidos: el aging puede promover un pedido que ha esperado más tiempo', () => {
  const heap = new MaxHeapPedidos(ahora);
  heap.push(pedido('TAR-RECIENTE', 'TARDÍO', 0));
  heap.push(pedido('ATI-ESPERA', 'A TIEMPO', 20));

  assert.equal(heap.pop()?.numeroPedido, 'ATI-ESPERA');
});