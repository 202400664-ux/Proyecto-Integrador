import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { autenticar as autenticarMfa } from './autenticacion.js';
import { autenticar as autenticarOperativo } from './autenticar.js';
import { verifyTempToken } from './verifyTempToken.js';

const secret = 'mfa-middleware-test-secret';
const previousSecret = process.env.JWT_SECRET;
process.env.JWT_SECRET = secret;

function crearRequest(token: string): Request {
  return {
    headers: { authorization: `Bearer ${token}` },
    header: () => `Bearer ${token}`,
  } as unknown as Request;
}

function crearResponse() {
  let statusCode = 200;
  let body: unknown;
  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(value: unknown) {
      body = value;
      return this;
    },
  } as unknown as Response;
  return { response, get statusCode() { return statusCode; }, get body() { return body; } };
}

test.after(() => {
  if (previousSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousSecret;
});

test('un token temporal MFA recibe 403 en ambos middleware de rutas operativas', async () => {
  const token = jwt.sign({ id: 'usuario-1', type: 'MFA_TEMP' }, secret, { expiresIn: '5m' });

  for (const middleware of [autenticarMfa, autenticarOperativo]) {
    const result = crearResponse();
    let calledNext = false;
    await middleware(crearRequest(token), result.response, () => { calledNext = true; });
    assert.equal(result.statusCode, 403);
    assert.equal(calledNext, false);
  }
});

test('verifyTempToken accepts a signed MFA_TEMP token and exposes only its user id', () => {
  const token = jwt.sign({ id: 'usuario-2', type: 'MFA_TEMP' }, secret, { expiresIn: '5m' });
  const request = crearRequest(token);
  const result = crearResponse();
  let calledNext = false;

  verifyTempToken(request, result.response, () => { calledNext = true; });

  assert.equal(calledNext, true);
  assert.equal(request.usuarioMfaTemporal?.id, 'usuario-2');
});

test('verifyTempToken rejects normal JWTs and tokens older than five minutes', () => {
  const normalToken = jwt.sign({ id: 'usuario-3', rol: 'operador' }, secret, { expiresIn: '8h' });
  const oldToken = jwt.sign({ id: 'usuario-3', type: 'MFA_TEMP' }, secret, { expiresIn: '10m' });

  for (const token of [normalToken, oldToken]) {
    const result = crearResponse();
    let calledNext = false;
    verifyTempToken(crearRequest(token), result.response, () => { calledNext = true; });
    assert.equal(result.statusCode, 401);
    assert.equal(calledNext, false);
  }
});
