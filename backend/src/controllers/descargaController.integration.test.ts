import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { iniciarDescarga, finalizarDescarga } from './descargaController.js';
import { Descarga } from '../models/Descarga.js';
import { Gateway } from '../models/Gateway.js';
import { Pedido } from '../models/Pedido.js';

const mongoTestUri = process.env.MONGO_TEST_URI;

test('iniciar y finalizar descarga mantiene pedido y gateway consistentes', { skip: !mongoTestUri }, async () => {
  const uri = new URL(mongoTestUri as string);
  const databaseName = uri.pathname.slice(1);
  assert.match(databaseName, /_test$/, 'MONGO_TEST_URI debe apuntar a una base cuyo nombre termine en _test');

  await mongoose.connect(mongoTestUri as string);
  try {
    await mongoose.connection.dropDatabase();
    const operadorId = new mongoose.Types.ObjectId();
    const gateway = await Gateway.create({
      numeroGateway: 1,
      tipoCargaPermitida: 'general',
      estado: 'LIBRE',
      activo: true,
      usuarioCreacion: 'Prueba',
      usuarioActualizacion: 'Prueba',
    });
    const pedido = await Pedido.create({
      numeroPedido: 'PED-EQUI04-000000001',
      proveedorId: new mongoose.Types.ObjectId(),
      tipoProducto: 'general',
      fechaHoraProgramada: new Date(),
      inicioVentana: new Date(),
      finVentana: new Date(Date.now() + 60_000),
      duracionEstimadaMinutos: 1,
      estado: 'GATEWAY_ASIGNADO',
      gatewayId: gateway._id,
      activo: true,
      usuarioCreacion: 'Prueba',
      usuarioActualizacion: 'Prueba',
    });
    await Gateway.updateOne({ _id: gateway._id }, { $set: { pedidoAsignadoId: pedido._id } });

    const usuario = { id: String(operadorId), rol: 'operador' as const, nombreCompleto: 'Operador de Prueba' };
    const iniciarResponse = respuestaFalsa();
    await iniciarDescarga(
      { body: { pedidoId: String(pedido._id), gatewayId: String(gateway._id) }, usuario } as never,
      iniciarResponse as never
    );
    assert.equal(iniciarResponse.statusCode, 201, JSON.stringify(iniciarResponse.body));

    const descarga = await Descarga.findOne({ pedidoId: pedido._id, fechaHoraFin: { $exists: false } });
    assert.ok(descarga, 'debe persistirse la descarga activa');

    const finalizarResponse = respuestaFalsa();
    await finalizarDescarga(
      { body: { descargaId: String(descarga._id) }, usuario } as never,
      finalizarResponse as never
    );
    assert.equal(finalizarResponse.statusCode, 200, JSON.stringify(finalizarResponse.body));

    const pedidoFinal = await Pedido.findById(pedido._id);
    const gatewayFinal = await Gateway.findById(gateway._id);
    const descargaFinal = await Descarga.findById(descarga._id);
    assert.equal(pedidoFinal?.estado, 'FINALIZADO');
    assert.equal(gatewayFinal?.estado, 'LIBRE');
    assert.equal(gatewayFinal?.pedidoAsignadoId, undefined);
    assert.ok(descargaFinal?.fechaHoraFin);
    assert.ok(descargaFinal?.duracionMinutos !== undefined);
  } finally {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

function respuestaFalsa() {
  return {
    statusCode: 200,
    body: null as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  };
}