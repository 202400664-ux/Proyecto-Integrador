import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import test from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import colaRoutes from '../routes/cola.js';
import descargasRoutes from '../routes/descargas.js';
import proveedoresRoutes from '../routes/proveedores.js';
import rolesRoutes from '../routes/roles.js';
import usuariosRoutes from '../routes/usuariosRoutes.js';
import { inicializarGateways } from '../controllers/gatewayController.js';
import { Descarga } from '../models/Descarga.js';
import { Evento } from '../models/Evento.js';
import { Gateway } from '../models/Gateway.js';
import { Parametro } from '../models/Parametro.js';
import { Pedido } from '../models/Pedido.js';
import { Proveedor } from '../models/Proveedor.js';
import { Role } from '../models/Role.js';
import { Usuario } from '../models/Usuario.js';
import { aplicarMigraciones } from './migraciones.js';

const mongoTestUri = process.env.MONGO_TEST_URI;
process.env.JWT_SECRET ??= 'secreto-de-pruebas';

let base = '';
let server: Server;

async function peticion(metodo: string, ruta: string, token: string, cuerpo?: unknown) {
  const respuesta = await fetch(`${base}${ruta}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  return { status: respuesta.status, body: await respuesta.json() };
}

async function crearSesion(email: string, nombreRol: string) {
  const rol = await Role.findOne({ nombreRol });
  const usuario = await Usuario.create({
    nombres: 'Usuario', apellidosCompleto: 'Prueba', email, password: 'Clave12345', roles: [rol!._id], estado: 'activo',
  });
  const token = jwt.sign({ id: usuario._id, rol: nombreRol, nombreCompleto: 'Usuario Prueba' }, process.env.JWT_SECRET as string);
  return { usuario, token };
}

test('Sprint 6 y 7: catálogo de roles, permisos y cola con aging', { skip: !mongoTestUri }, async (t) => {
  const uri = new URL(mongoTestUri as string);
  uri.pathname = '/sprint67_test';
  await mongoose.connect(uri.toString());
  await mongoose.connection.dropDatabase();

  // Datos con el formato de sprints anteriores: la migración debe adaptarlos.
  const rolesAntiguos = mongoose.connection.collection('roles');
  await rolesAntiguos.createIndex({ nombre: 1 }, { unique: true });
  await rolesAntiguos.insertMany(['administrador', 'coordinador', 'operador'].map((nombre) => ({ nombre, descripcion: `Rol ${nombre}` })));
  const { insertedId: pedidoAntiguoId } = await mongoose.connection.collection('pedidos').insertOne({
    numeroPedido: 'ANTIGUO', estado: 'GATEWAY_ASIGNADO', fechaEntradaCola: new Date(), activo: true,
  });

  await aplicarMigraciones();
  await aplicarMigraciones();
  await inicializarGateways();

  await t.test('migra roles y pedidos de sprints anteriores de forma idempotente', async () => {
    assert.deepEqual((await Role.findOne({ nombreRol: 'operador' }))?.permisos, ['descargas', 'cola']);
    assert.equal(await Role.countDocuments({ nombreRol: { $in: ['administrador', 'coordinador', 'operador'] }, activo: true }), 3);
    const pedido = await mongoose.connection.collection('pedidos').findOneAndDelete({ _id: pedidoAntiguoId });
    assert.equal(pedido?.estado, 'GATEWAY ASIGNADO');
    assert.ok(pedido?.fechaHoraIngresoCola);
  });

  const app = express();
  app.use(express.json());
  app.use('/api/roles', rolesRoutes);
  app.use('/api/usuarios', usuariosRoutes);
  app.use('/api/proveedores', proveedoresRoutes);
  app.use('/api/cola', colaRoutes);
  app.use('/api/descargas', descargasRoutes);
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;

  const admin = await crearSesion('admin@test.local', 'administrador');
  const operador = await crearSesion('operador@test.local', 'operador');

  try {
    let rolId = '';

    await t.test('crea un rol con permisos válidos y registra el evento', async () => {
      const creado = await peticion('POST', '/roles', admin.token, { nombreRol: 'Supervisor de Turno', descripcion: 'Supervisa el turno', permisos: ['cola', 'kpis'] });
      assert.equal(creado.status, 201);
      rolId = creado.body.rol._id;
      assert.equal(await Evento.countDocuments({ accion: 'ROL_CREADO' }), 1);
    });

    await t.test('rechaza nombres duplicados sin distinguir mayúsculas', async () => {
      const duplicado = await peticion('POST', '/roles', admin.token, { nombreRol: 'SUPERVISOR de turno', descripcion: 'Otra', permisos: ['cola'] });
      assert.equal(duplicado.status, 409);
    });

    await t.test('rechaza permisos fuera de la lista cerrada', async () => {
      const invalido = await peticion('POST', '/roles', admin.token, { nombreRol: 'Rol Invalido', descripcion: 'x', permisos: ['cola', 'nomina'] });
      assert.equal(invalido.status, 400);
    });

    await t.test('filtra el catálogo por activo', async () => {
      const activos = await peticion('GET', '/roles?activo=true', admin.token);
      assert.equal(activos.status, 200);
      assert.ok(activos.body.roles.every((rol: { activo: boolean }) => rol.activo));
      assert.equal(activos.body.roles.length, 4);
    });

    await t.test('checkPermission bloquea a quien no tiene el módulo', async () => {
      assert.equal((await peticion('GET', '/roles', operador.token)).status, 403);
      assert.equal((await peticion('GET', '/proveedores', operador.token)).status, 403);
    });

    let usuarioId = '';
    let tokenSupervisor = '';

    await t.test('asigna el rol dinámico por _id y registra ROL_ASIGNADO_USUARIO', async () => {
      const creado = await peticion('POST', '/usuarios', admin.token, {
        nombres: 'Sara', apellidosCompleto: 'Supervisora', email: 'sara@test.local', password: 'Clave12345', roles: [rolId], mfaObligatorio: false,
      });
      assert.equal(creado.status, 201);
      usuarioId = creado.body.id;
      assert.equal(creado.body.roles[0].nombreRol, 'Supervisor de Turno');
      assert.equal(await Evento.countDocuments({ accion: 'ROL_ASIGNADO_USUARIO' }), 1);
      tokenSupervisor = jwt.sign({ id: usuarioId, rol: 'Supervisor de Turno', nombreCompleto: 'Sara Supervisora' }, process.env.JWT_SECRET as string);
    });

    await t.test('el usuario solo entra a los módulos de su rol personalizado', async () => {
      assert.equal((await peticion('GET', '/cola', tokenSupervisor)).status, 200);
      assert.equal((await peticion('GET', '/usuarios', tokenSupervisor)).status, 403);
    });

    await t.test('un cambio de permisos aplica sin volver a iniciar sesión', async () => {
      const editado = await peticion('PUT', `/roles/${rolId}`, admin.token, { permisos: ['kpis'] });
      assert.equal(editado.status, 200);
      assert.equal((await peticion('GET', '/cola', tokenSupervisor)).status, 403);
      assert.equal(await Evento.countDocuments({ accion: 'ROL_MODIFICADO' }), 1);
    });

    await t.test('bloquea la baja lógica mientras haya usuarios activos', async () => {
      const bloqueado = await peticion('DELETE', `/roles/${rolId}`, admin.token);
      assert.equal(bloqueado.status, 409);
      assert.equal(bloqueado.body.usuariosVinculados, 1);
      assert.equal((await Role.findById(rolId))?.activo, true);
    });

    await t.test('permite la baja lógica sin usuarios activos y conserva el documento', async () => {
      await peticion('PATCH', `/usuarios/${usuarioId}`, admin.token, { activo: false });
      const baja = await peticion('DELETE', `/roles/${rolId}`, admin.token);
      assert.equal(baja.status, 200);
      assert.equal((await Role.findById(rolId))?.activo, false);
      assert.equal(await Evento.countDocuments({ accion: 'ROL_DESACTIVADO' }), 1);
    });

    await t.test('protege los roles base', async () => {
      const administrador = await Role.findOne({ nombreRol: 'administrador' });
      assert.equal((await peticion('DELETE', `/roles/${administrador!._id}`, admin.token)).status, 400);
      assert.equal((await peticion('PUT', `/roles/${administrador!._id}`, admin.token, { permisos: ['kpis'] })).status, 400);
    });

    await t.test('no permite asignar un rol inactivo', async () => {
      const rechazo = await peticion('PATCH', `/usuarios/${operador.usuario._id}`, admin.token, { roles: [rolId] });
      assert.equal(rechazo.status, 400);
    });

    await t.test('la cola ordena por prioridad, aplica aging y promueve al liberar la bahía', async () => {
      await Parametro.updateOne({ clave: 'factor_aging_min' }, { $set: { valor: '5' } });
      const proveedor = await Proveedor.create({
        razonSocial: 'Proveedor Prueba', identificacionTributaria: '123456', categoria: 'general', contactoNombre: 'Ana', telefono: '2222-3333', emailContacto: 'a@b.cd',
      });
      const crear = (numeroPedido: string, clasificacion: 'A TIEMPO' | 'ANTICIPADO' | 'TARDÍO', minutos: number, prioridadCalculada: number) => Pedido.create({
        numeroPedido, proveedorId: proveedor._id, tipoProducto: 'general', fechaHoraProgramada: new Date(), inicioVentana: new Date(), finVentana: new Date(Date.now() + 3_600_000),
        duracionEstimadaMinutos: 60, estado: 'EN COLA', clasificacionPuntualidad: clasificacion, fechaHoraIngresoCola: new Date(Date.now() - minutos * 60_000), prioridadCalculada, minutosEnEspera: 0,
      });
      await crear('ANTICIPADO', 'ANTICIPADO', 0, 2);
      await crear('A-TIEMPO', 'A TIEMPO', 0, 3);
      await crear('TARDIO-VIEJO', 'TARDÍO', 25, 1);

      const gatewaysOcupados = await Gateway.find({ numeroGateway: { $in: [1, 2, 3, 4] } });
      await Gateway.updateMany({ numeroGateway: { $in: [1, 2, 3, 4] } }, { $set: { estado: 'OCUPADO' } });

      const cola = await peticion('GET', '/cola', operador.token);
      assert.equal(cola.status, 200);
      assert.deepEqual(cola.body.pedidos.map((pedido: { numeroPedido: string }) => pedido.numeroPedido), ['TARDIO-VIEJO', 'A-TIEMPO', 'ANTICIPADO']);
      assert.equal(cola.body.pedidos[0].prioridadCalculada, 6);
      assert.equal(cola.body.pedidos[0].minutosEnEspera, 25);
      assert.equal(cola.body.pedidos[0].proveedorId.razonSocial, 'Proveedor Prueba');
      assert.equal(await Evento.countDocuments({ accion: 'AGING_APLICADO' }), 1);

      const enDescarga = await Pedido.create({
        numeroPedido: 'EN-DESCARGA', proveedorId: proveedor._id, tipoProducto: 'general', fechaHoraProgramada: new Date(), inicioVentana: new Date(), finVentana: new Date(Date.now() + 3_600_000),
        duracionEstimadaMinutos: 60, estado: 'DESCARGANDO', gatewayId: gatewaysOcupados[0]._id,
      });
      const descarga = await Descarga.create({
        gatewayId: gatewaysOcupados[0]._id, pedidoId: enDescarga._id, operadorId: operador.usuario._id, fechaHoraInicio: new Date(), usuarioCreacion: 'Prueba', usuarioActualizacion: 'Prueba',
      });

      const finalizada = await peticion('POST', '/descargas/finalizar', operador.token, { descargaId: String(descarga._id) });
      assert.equal(finalizada.status, 200);
      const promovido = await Pedido.findOne({ numeroPedido: 'TARDIO-VIEJO' });
      assert.equal(promovido?.estado, 'GATEWAY ASIGNADO');
      assert.equal(String(promovido?.gatewayId), String(gatewaysOcupados[0]._id));
      assert.equal(await Evento.countDocuments({ accion: 'PROMOCION_AUTOMATICA_GATEWAY' }), 1);
    });
  } finally {
    server.close();
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
