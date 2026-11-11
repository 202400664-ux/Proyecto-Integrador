import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import { Usuario } from '../models/Usuario.js';
import { Role, type IRole } from '../models/Role.js';
import { verificarCodigoTotp } from '../services/mfa.js';
import { construirPayloadSesion } from '../services/permisos.js';

async function obtenerUsuarioTemporal(id: string) {
  return Usuario.findById(id)
    .select('+twoFactorSecret')
    .populate<{ roles: IRole[] }>({ path: 'roles', model: Role });
}

export async function setupMfa(req: Request, res: Response): Promise<void> {
  const id = req.usuarioMfaTemporal?.id;
  if (!id) {
    res.status(401).json({ mensaje: 'Se requiere un token temporal de MFA' });
    return;
  }

  const usuario = await obtenerUsuarioTemporal(id);
  if (!usuario || usuario.activo === false || usuario.estado !== 'activo') {
    res.status(401).json({ mensaje: 'La sesión no pertenece a un usuario activo' });
    return;
  }
  if (usuario.twoFactorEnabled) {
    res.status(409).json({ mensaje: 'La autenticación multifactor ya está habilitada' });
    return;
  }

  const nombreCompleto = `${usuario.nombres} ${usuario.apellidosCompleto}`.trim();
  const issuer = 'Sistema de Gestión Logística';
  let otpauthUrl: string;
  if (usuario.twoFactorSecret) {
    otpauthUrl = speakeasy.otpauthURL({
      secret: usuario.twoFactorSecret,
      label: `${nombreCompleto} (${usuario.email})`,
      issuer,
      encoding: 'base32',
    });
  } else {
    const secret = speakeasy.generateSecret({
      length: 20,
      name: `${nombreCompleto} (${usuario.email})`,
      issuer,
    });
    if (!secret.base32 || !secret.otpauth_url) {
      res.status(500).json({ mensaje: 'No se pudo generar la configuración de MFA' });
      return;
    }
    usuario.twoFactorSecret = secret.base32;
    await usuario.save();
    otpauthUrl = secret.otpauth_url;
  }

  res.status(200).json({
    mensaje: 'Escanee el código QR con Google Authenticator',
    otpauthUrl,
    account: usuario.email,
    issuer,
  });
}

export async function enableMfa(req: Request, res: Response): Promise<void> {
  const id = req.usuarioMfaTemporal?.id;
  if (!id) {
    res.status(401).json({ mensaje: 'Se requiere un token temporal de MFA' });
    return;
  }

  const usuario = await obtenerUsuarioTemporal(id);
  if (!usuario || usuario.activo === false || usuario.estado !== 'activo') {
    res.status(401).json({ mensaje: 'La sesión no pertenece a un usuario activo' });
    return;
  }
  if (!usuario.twoFactorSecret) {
    res.status(409).json({ mensaje: 'Debe generar la configuración QR antes de activar MFA' });
    return;
  }
  if (!verificarCodigoTotp(usuario.twoFactorSecret, req.body?.code)) {
    res.status(401).json({ mensaje: 'El código de autenticación es incorrecto o expiró' });
    return;
  }

  usuario.twoFactorEnabled = true;
  usuario.usuarioActualizacion = `${usuario.nombres} ${usuario.apellidosCompleto}`.trim();
  await usuario.save();
  res.status(200).json({ mensaje: 'Autenticación multifactor habilitada correctamente' });
}

export async function verifyMfaLogin(req: Request, res: Response): Promise<void> {
  const id = req.usuarioMfaTemporal?.id;
  if (!id) {
    res.status(401).json({ mensaje: 'Se requiere un token temporal de MFA' });
    return;
  }

  const usuario = await obtenerUsuarioTemporal(id);
  if (!usuario || usuario.activo === false || usuario.estado !== 'activo') {
    res.status(401).json({ mensaje: 'La sesión no pertenece a un usuario activo' });
    return;
  }
  if (!usuario.twoFactorEnabled || !usuario.twoFactorSecret) {
    res.status(403).json({ mensaje: 'Debe completar el enrolamiento MFA antes de iniciar sesión' });
    return;
  }
  if (!verificarCodigoTotp(usuario.twoFactorSecret, req.body?.code)) {
    res.status(401).json({ mensaje: 'El código de autenticación es incorrecto o expiró' });
    return;
  }

  const sesion = construirPayloadSesion(usuario);
  if (!sesion) {
    res.status(403).json({ mensaje: 'El usuario no tiene un rol activo asignado' });
    return;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ mensaje: 'JWT_SECRET no está configurado' });
    return;
  }

  const token = jwt.sign(
    sesion,
    secret,
    { expiresIn: '8h' }
  );

  res.status(200).json({ mensaje: 'Autenticación multifactor exitosa', token });
}
