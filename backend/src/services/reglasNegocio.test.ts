import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluarTolerancia,
  validarCompatibilidadBahia,
  formatearNumeroPedido,
  esNumeroPedidoValido,
  TOLERANCIAS_POR_DEFECTO,
} from './reglasNegocio.js';

const ventana = {
  inicioVentana: new Date('2026-11-10T08:00:00.000Z'),
  finVentana: new Date('2026-11-10T09:00:00.000Z'),
};
const tolerancias = { anticipado: TOLERANCIAS_POR_DEFECTO.anticipado, tardio: TOLERANCIAS_POR_DEFECTO.tardio };
const minutos = (base: Date, delta: number) => new Date(base.getTime() + delta * 60_000);

test('PU-01 formatearNumeroPedido genera PED-EQUI04-000000001 (RN-01)', () => {
  assert.equal(formatearNumeroPedido(4, 1), 'PED-EQUI04-000000001');
  assert.equal(esNumeroPedidoValido('PED-EQUI04-000000001'), true);
  assert.equal(esNumeroPedidoValido('PED-EQUI4-1'), false);
  assert.throws(() => formatearNumeroPedido(100, 1));
});

test('PU-02 evaluarTolerancia: llegada dentro de la ventana es A TIEMPO (RN-04)', () => {
  assert.equal(evaluarTolerancia(minutos(ventana.inicioVentana, 30), ventana, tolerancias), 'A TIEMPO');
});

test('PU-03 evaluarTolerancia: 10 min después del fin, dentro de la tolerancia, es A TIEMPO (RN-04)', () => {
  assert.equal(evaluarTolerancia(minutos(ventana.finVentana, 10), ventana, tolerancias), 'A TIEMPO');
});

test('PU-04 validarCompatibilidadBahia: Gateway 5 acepta construcción (RN-08)', () => {
  assert.equal(validarCompatibilidadBahia({ numeroGateway: 5, estado: 'LIBRE', activo: true }, 'construcción'), true);
});

test('PU-05 validarCompatibilidadBahia: Gateway 5 rechaza carga general (RN-08)', () => {
  assert.equal(validarCompatibilidadBahia({ numeroGateway: 5, estado: 'LIBRE', activo: true }, 'general'), false);
});

test('PU-06 validarCompatibilidadBahia: Gateways 1 a 4 aceptan carga general (RN-07)', () => {
  for (const numeroGateway of [1, 2, 3, 4]) {
    assert.equal(validarCompatibilidadBahia({ numeroGateway, estado: 'LIBRE', activo: true }, 'general'), true);
  }
});

test('PU-07 validarCompatibilidadBahia: Gateways 1 a 4 rechazan construcción (RN-07/RN-08)', () => {
  for (const numeroGateway of [1, 2, 3, 4]) {
    assert.equal(validarCompatibilidadBahia({ numeroGateway, estado: 'LIBRE', activo: true }, 'construcción'), false);
  }
});

test('PU-08 evaluarTolerancia: 16 min después del fin es TARDÍO (RN-04)', () => {
  assert.equal(evaluarTolerancia(minutos(ventana.finVentana, 16), ventana, tolerancias), 'TARDÍO');
});

test('PU-09 evaluarTolerancia: 20 min antes del inicio es ANTICIPADO (RN-04)', () => {
  assert.equal(evaluarTolerancia(minutos(ventana.inicioVentana, -20), ventana, tolerancias), 'ANTICIPADO');
});

test('PU-10 evaluarTolerancia: los bordes de la tolerancia de 15 min son inclusivos y se validan las fechas', () => {
  assert.equal(evaluarTolerancia(minutos(ventana.inicioVentana, -15), ventana, tolerancias), 'A TIEMPO');
  assert.equal(evaluarTolerancia(minutos(ventana.finVentana, 15), ventana, tolerancias), 'A TIEMPO');
  assert.equal(evaluarTolerancia(new Date(minutos(ventana.finVentana, 15).getTime() + 1), ventana, tolerancias), 'TARDÍO');
  assert.equal(evaluarTolerancia(new Date(minutos(ventana.inicioVentana, -15).getTime() - 1), ventana, tolerancias), 'ANTICIPADO');
  assert.throws(() => evaluarTolerancia('fecha-invalida', ventana, tolerancias));
  assert.throws(() => evaluarTolerancia(ventana.inicioVentana, { inicioVentana: ventana.finVentana, finVentana: ventana.inicioVentana }, tolerancias));
});

test('PU-14 validarCompatibilidadBahia: una bahía fuera de servicio o inactiva no es compatible (RN-13/RN-14)', () => {
  assert.equal(validarCompatibilidadBahia({ numeroGateway: 2, estado: 'FUERA DE SERVICIO', activo: true }, 'general'), false);
  assert.equal(validarCompatibilidadBahia({ numeroGateway: 5, estado: 'LIBRE', activo: false }, 'construcción'), false);
  assert.equal(validarCompatibilidadBahia({ numeroGateway: 6, estado: 'LIBRE', activo: true }, 'general'), false);
});
