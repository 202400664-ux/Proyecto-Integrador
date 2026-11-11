import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export interface UsuarioAutenticado {
  id: string;
  rol: string;
  nombreCompleto: string;
}

declare global {
  namespace Express {
    interface Request {
      usuario?: UsuarioAutenticado;
    }
  }
}

export const autenticar = (req: Request, res: Response, next: NextFunction): void => {
  const encabezado = req.headers.authorization;
  const token = encabezado?.startsWith('Bearer ') ? encabezado.slice(7) : '';
  const secret = process.env.JWT_SECRET;

  if (!token || !secret) {
    res.status(401).json({ mensaje: 'Se requiere una sesión autenticada' });
    return;
  }

  try {
    const payload = jwt.verify(token, secret);
    if (typeof payload !== 'string' && payload.type === 'MFA_TEMP') {
      res.status(403).json({ mensaje: 'El token temporal MFA no permite acceder a rutas operativas' });
      return;
    }
    if (typeof payload === 'string' || !payload.id || !payload.rol) {
      res.status(401).json({ mensaje: 'Token de sesión inválido' });
      return;
    }
    req.usuario = {
      id: String(payload.id),
      rol: String(payload.rol),
      nombreCompleto: String(payload.nombreCompleto || payload.email || 'Usuario'),
    };
    next();
  } catch {
    res.status(401).json({ mensaje: 'La sesión expiró o no es válida' });
  }
};
