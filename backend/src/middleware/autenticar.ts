import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Role, type IRole, type RoleName } from '../models/Role.js';
import { Usuario } from '../models/Usuario.js';

export interface UsuarioAutenticado {
  id: string;
  email: string;
  nombreCompleto: string;
  rol: RoleName;
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
      .select('nombres apellidosCompleto email estado roles')
      .populate<{ roles: IRole[] }>({ path: 'roles', model: Role });
    if (!usuario || usuario.estado !== 'activo') {
      res.status(401).json({ mensaje: 'La sesión no pertenece a un usuario activo' });
      return;
    }

    const rolesPermitidos: RoleName[] = ['administrador', 'coordinador', 'operador'];
    const rol = usuario.roles.find((role) => rolesPermitidos.includes(role.nombre));
    if (!rol) {
      res.status(403).json({ mensaje: 'El usuario no tiene un rol autorizado' });
      return;
    }

    req.usuarioAutenticado = {
      id: String(usuario._id),
      email: usuario.email,
      nombreCompleto: `${usuario.nombres} ${usuario.apellidosCompleto}`.trim(),
      rol: rol.nombre,
    };
    next();
  } catch {
    res.status(500).json({ mensaje: 'No se pudo validar el usuario autenticado' });
  }
}

export function autorizar(...roles: RoleName[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.usuarioAutenticado) {
      res.status(401).json({ mensaje: 'Se requiere autenticación' });
      return;
    }
    if (!roles.includes(req.usuarioAutenticado.rol)) {
      res.status(403).json({ mensaje: 'No tienes permiso para realizar esta acción' });
      return;
    }
    next();
  };
}