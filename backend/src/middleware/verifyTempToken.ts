import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export interface UsuarioMfaTemporal {
  id: string;
}

declare global {
  namespace Express {
    interface Request {
      usuarioMfaTemporal?: UsuarioMfaTemporal;
    }
  }
}

export function verifyTempToken(req: Request, res: Response, next: NextFunction): void {
  const authorization = req.header('Authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    res.status(500).json({ mensaje: 'JWT_SECRET no está configurado' });
    return;
  }
  if (!token) {
    res.status(401).json({ mensaje: 'Se requiere un token temporal de MFA' });
    return;
  }

  try {
    const payload = jwt.verify(token, secret, { maxAge: '5m' });
    if (
      typeof payload === 'string'
      || payload.type !== 'MFA_TEMP'
      || typeof payload.id !== 'string'
      || typeof payload.iat !== 'number'
      || typeof payload.exp !== 'number'
      || payload.exp <= payload.iat
      || payload.exp - payload.iat > 5 * 60
    ) {
      res.status(401).json({ mensaje: 'Token temporal de MFA inválido' });
      return;
    }

    req.usuarioMfaTemporal = { id: payload.id };
    next();
  } catch {
    res.status(401).json({ mensaje: 'El token temporal de MFA expiró o no es válido' });
  }
}
