import { MODULOS_PERMISO, esRolBase, type IRole, type ModuloPermiso } from '../models/Role.js';

export function rolesActivos<T extends Pick<IRole, 'activo'>>(roles: T[]): T[] {
  return roles.filter((rol) => rol.activo !== false);
}

/** Unión de los módulos habilitados en los roles activos del usuario. */
export function permisosDeRoles(roles: Array<Pick<IRole, 'activo' | 'permisos'>>): ModuloPermiso[] {
  return [...new Set(rolesActivos(roles).flatMap((rol) => rol.permisos ?? []))];
}

export function tieneAlgunPermiso(permisos: readonly string[], requeridos: readonly ModuloPermiso[]): boolean {
  return requeridos.some((modulo) => permisos.includes(modulo));
}

/** Devuelve los permisos sin repetidos, o null si alguno no pertenece a la lista cerrada de módulos. */
export function normalizarPermisos(valor: unknown): ModuloPermiso[] | null {
  if (!Array.isArray(valor)) return null;
  if (!valor.every((item) => (MODULOS_PERMISO as readonly unknown[]).includes(item))) return null;
  return [...new Set(valor as ModuloPermiso[])];
}

interface UsuarioParaSesion {
  _id: unknown;
  email: string;
  nombres: string;
  apellidosCompleto: string;
  roles: IRole[];
}

export interface PayloadSesion {
  id: unknown;
  email: string;
  rol: string;
  roles: string[];
  permisos: ModuloPermiso[];
  nombreCompleto: string;
}

/** Arma el contenido del JWT; devuelve null si el usuario no tiene ningún rol activo. */
export function construirPayloadSesion(usuario: UsuarioParaSesion): PayloadSesion | null {
  const activos = rolesActivos(usuario.roles);
  if (activos.length === 0) return null;
  const principal = activos.find((rol) => esRolBase(rol.nombreRol)) ?? activos[0];
  return {
    id: usuario._id,
    email: usuario.email,
    rol: principal.nombreRol,
    roles: activos.map((rol) => rol.nombreRol),
    permisos: permisosDeRoles(activos),
    nombreCompleto: `${usuario.nombres} ${usuario.apellidosCompleto}`.trim(),
  };
}
