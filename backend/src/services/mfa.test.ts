import assert from 'node:assert/strict';
import test from 'node:test';
import speakeasy from 'speakeasy';
import { verificarCodigoTotp } from './mfa.js';

const secret = 'JBSWY3DPEHPK3PXP';
const time = 1_800_000_000;

function codigoEn(instant: number) {
  return speakeasy.totp({ secret, encoding: 'base32', time: instant });
}

test('acepta códigos TOTP del intervalo actual y de un intervalo de tolerancia', () => {
  assert.equal(verificarCodigoTotp(secret, codigoEn(time), time), true);
  assert.equal(verificarCodigoTotp(secret, codigoEn(time - 30), time), true);
  assert.equal(verificarCodigoTotp(secret, codigoEn(time + 30), time), true);
});

test('rechaza códigos TOTP fuera de la ventana y códigos que no tengan seis dígitos', () => {
  assert.equal(verificarCodigoTotp(secret, codigoEn(time - 60), time), false);
  assert.equal(verificarCodigoTotp(secret, '12345', time), false);
  assert.equal(verificarCodigoTotp(secret, '12a456', time), false);
});
