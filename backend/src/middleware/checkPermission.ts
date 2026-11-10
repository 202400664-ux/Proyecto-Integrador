import type { NextFunction, Request, Response } from 'express';
import { Role, type IRole, type ModuloPermiso } from '../models/Role.js';
import { Usuario } from '../models/Usuario.js';
import { permisosDeRoles, tieneAlgunPermiso } from '../services/permisos.js';

/**
 * Exige que el usuario autenticado tenga, en sus roles activos, al menos uno
 * de los módulos indicados. Consulta la BD en cada petición para que un cambio
 * de permisos aplique de inmediato, sin esperar a que expire el token.
 */
export function checkPermission(...modulos: ModuloPermiso[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const id = req.usuarioAutenticado?.id ?? req.usuario?.id;
    if (!id) {
      res.status(401).json({ mensaje: 'Se requiere autenticación' });
      return;
    }

    try {
      const usuario = await Usuario.findById(id)
        .select('estado activo roles')
        .populate<{ roles: IRole[] }>({ path: 'roles', model: Role });
      if (!usuario || usuario.activo === false || usuario.estado !== 'activo') {
        res.status(401).json({ mensaje: 'La sesión no pertenece a un usuario activo' });
        return;
      }
      if (!tieneAlgunPermiso(permisosDeRoles(usuario.roles), modulos)) {
        res.status(403).json({ mensaje: `No tiene permiso para acceder al módulo: ${modulos.join(', ')}` });
        return;
      }
      next();
    } catch {
      res.status(500).json({ mensaje: 'No se pudieron validar los permisos del usuario' });
    }
  };
}
