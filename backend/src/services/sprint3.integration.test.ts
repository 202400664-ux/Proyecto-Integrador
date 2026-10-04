import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { generarNumeroPedido } from '../controllers/pedidoController.js';
import { Gateway } from '../models/Gateway.js';
import { Pedido } from '../models/Pedido.js';
import { Parametro } from '../models/Parametro.js';
import { ContadorPedido } from '../models/ContadorPedido.js';
import { reevaluarCola } from './colaPrioridad.js';

const mongoTestUri = process.env.MONGO_TEST_URI;

test('correlativo evita colisiones y cola respeta compatibilidad y prioridad', { skip: !mongoTestUri }, async () => {
  const uri = new URL(mongoTestUri as string);
  const databaseName = 'sprint3_queue_test';
  uri.pathname = `/${databaseName}`;
  await mongoose.connect(uri.toString());
  try {
    await mongoose.connection.dropDatabase();
    const equipo = Number(process.env.EQUIPO_NUMERO) || 4;
    await Parametro.create({
      clave: 'numero_equipo',
      valor: String(equipo).padStart(2, '0'),
      descripcion: 'Equipo asignado para el test de correlativo',
    });
    const codigo = (correlativo: number) => `PED-EQUI${String(equipo).padStart(2, '0')}-${String(correlativo).padStart(9, '0')}`;

    await crearPedido(codigo(1), 'general', 'PROGRAMADO');
    await ContadorPedido.deleteMany({ equipo });
    const correlativos = await Promise.all([generarNumeroPedido(), generarNumeroPedido()]);
    assert.deepEqual(correlativos.sort(), [codigo(2), codigo(3)]);

    const gatewayGeneral = await Gateway.create({ numeroGateway: 1, tipoCargaPermitida: 'general', estado: 'LIBRE', activo: true });
    const gatewayConstruccion = await Gateway.create({ numeroGateway: 5, tipoCargaPermitida: 'construcción', estado: 'LIBRE', activo: true });
    const tardio = await crearPedido(codigo(4), 'general', 'EN_COLA', 20);
    const aTiempo = await crearPedido(codigo(5), 'general', 'EN_COLA', 0);
    const construccion = await crearPedido(codigo(6), 'construcción', 'EN_COLA', 0);

    await reevaluarCola();

    const pedidosActualizados = await Pedido.find({ _id: { $in: [tardio._id, aTiempo._id, construccion._id] } });
    const pedidoTardio = pedidosActualizados.find((pedido) => String(pedido._id) === String(tardio._id));
    const pedidoATiempo = pedidosActualizados.find((pedido) => String(pedido._id) === String(aTiempo._id));
    const pedidoConstruccion = pedidosActualizados.find((pedido) => String(pedido._id) === String(construccion._id));

    assert.equal(pedidoTardio?.estado, 'GATEWAY_ASIGNADO');
    assert.equal(String(pedidoTardio?.gatewayId), String(gatewayGeneral._id));
    assert.equal(pedidoATiempo?.estado, 'EN_COLA');
    assert.equal(pedidoConstruccion?.estado, 'GATEWAY_ASIGNADO');
    assert.equal(String(pedidoConstruccion?.gatewayId), String(gatewayConstruccion._id));
  } finally {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

async function crearPedido(numeroPedido: string, tipoProducto: 'general' | 'construcción', estado: 'PROGRAMADO' | 'EN_COLA', esperaMinutos = 0) {
  const inicio = new Date(Date.now() + 60 * 60_000);
  return Pedido.create({
    numeroPedido,
    proveedorId: new mongoose.Types.ObjectId(),
    tipoProducto,
    fechaHoraProgramada: inicio,
    inicioVentana: inicio,
    finVentana: new Date(inicio.getTime() + 60 * 60_000),
    duracionEstimadaMinutos: 60,
    estado,
    clasificacionPuntualidad: estado === 'EN_COLA' ? (tipoProducto === 'general' ? 'TARDÍO' : 'A TIEMPO') : undefined,
    fechaEntradaCola: new Date(Date.now() - esperaMinutos * 60_000),
    activo: true,
    usuarioCreacion: 'Prueba',
    usuarioActualizacion: 'Prueba',
  });
}