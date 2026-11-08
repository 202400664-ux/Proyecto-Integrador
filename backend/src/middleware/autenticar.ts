import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Role, type IRole, type RoleName } from '../models/Role.js';
import { Usuario } from '../models/Usuario.js';
import { construirPayloadSesion } from '../services/permisos.js';

export interface UsuarioAutenticado {
  id: string;
  email: string;
  nombreCompleto: string;
  rol: string;
  roles: string[];
}

declare global {
  namespace Express {
    interface Request {
      usuarioAutenticado?: UsuarioAutenticado;
    }
  }
}

export async function autenticar(req: Request, res: Response, next: NextFunction): Promise<void> {
  const autorizacion = req.header('Authorization');
  const token = autorizacion?.startsWith('Bearer ') ? autorizacion.slice(7) : '';
  if (!token) {
    res.status(401).json({ mensaje: 'Se requiere autenticación' });
    return;
  }

  const claveSecreta = process.env.JWT_SECRET;
  if (!claveSecreta) {
    res.status(500).json({ mensaje: 'JWT_SECRET no está configurado' });
    return;
  }

  let idUsuario: string;
  try {
    const payload = jwt.verify(token, claveSecreta);
    if (typeof payload !== 'string' && payload.type === 'MFA_TEMP') {
      res.status(403).json({ mensaje: 'El token temporal MFA no permite acceder a rutas operativas' });
      return;
    }
    if (typeof payload === 'string' || typeof payload.id !== 'string') {
      res.status(401).json({ mensaje: 'Token de autenticación inválido' });
      return;
    }
    idUsuario = payload.id;
  } catch {
    res.status(401).json({ mensaje: 'Token de autenticación inválido o expirado' });
    return;
  }

  try {
    const usuario = await Usuario.findById(idUsuario)
      .select('nombres apellidosCompleto email estado activo roles')
      .populate<{ roles: IRole[] }>({ path: 'roles', model: Role });
    if (!usuario || usuario.activo === false || usuario.estado !== 'activo') {
      res.status(401).json({ mensaje: 'La sesión no pertenece a un usuario activo' });
      return;
    }

    const sesion = construirPayloadSesion(usuario);
    if (!sesion) {
      res.status(403).json({ mensaje: 'El usuario no tiene un rol activo' });
      return;
    }

    req.usuarioAutenticado = {
      id: String(usuario._id),
      email: usuario.email,
      nombreCompleto: sesion.nombreCompleto,
      rol: sesion.rol,
      roles: sesion.roles,
    };
    next();
  } catch {
    res.status(500).json({ mensaje: 'No se pudo validar el usuario autenticado' });
  }
}

/** Restringe a roles base las funciones que no forman parte del catálogo de módulos. */
export function autorizar(...roles: RoleName[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.usuarioAutenticado) {
      res.status(401).json({ mensaje: 'Se requiere autenticación' });
      return;
    }
    if (!roles.some((rol) => req.usuarioAutenticado?.roles.includes(rol))) {
      res.status(403).json({ mensaje: 'No tienes permiso para realizar esta acción' });
      return;
    }
    next();
  };
}