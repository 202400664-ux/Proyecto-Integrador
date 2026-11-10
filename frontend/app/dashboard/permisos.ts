import { jwtDecode } from 'jwt-decode';

/** Lista cerrada de módulos que se habilitan por rol desde /admin/roles. */
export const MODULOS = [
  { clave: 'usuarios', etiqueta: 'Usuarios', ayuda: 'Administrar cuentas de usuario' },
  { clave: 'roles', etiqueta: 'Roles', ayuda: 'Administrar el catálogo de roles' },
  { clave: 'proveedores', etiqueta: 'Proveedores', ayuda: 'Catálogo de proveedores' },
  { clave: 'pedidos', etiqueta: 'Pedidos', ayuda: 'Programación de citas' },
  { clave: 'gateways', etiqueta: 'Gateways', ayuda: 'Configurar bahías de descarga' },
  { clave: 'descargas', etiqueta: 'Descargas', ayuda: 'Tablero y control de descargas' },
  { clave: 'cola', etiqueta: 'Cola', ayuda: 'Caseta de llegadas y cola de prioridad' },
  { clave: 'kpis', etiqueta: 'KPIs', ayuda: 'Indicadores logísticos' },
] as const;

export type Modulo = (typeof MODULOS)[number]['clave'];

/**
 * Cada acción del sistema se identifica con un permiso ("recurso.accion").
 * La interfaz es la MISMA para todos los roles; lo único que cambia es qué
 * acciones puede ejecutar cada usuario, controlado desde este único lugar.
 */
export type Permiso =
  | 'usuarios.gestionar'
  | 'roles.gestionar'
  | 'proveedores.ver'
  | 'proveedores.crear'
  | 'proveedores.editar'
  | 'proveedores.inactivar'
  | 'pedidos.ver'
  | 'pedidos.crear'
  | 'pedidos.editar'
  | 'pedidos.cancelar'
  | 'parametros.ver'
  | 'parametros.editar'
  | 'caseta.registrar'
  | 'cola.ver'
  | 'auditoria.ver'
  | 'gateways.ver'
  | 'gateways.admin'
  | 'descargas.operar'
  | 'dashboard.kpis';

const MODULOS_POR_PERMISO: Partial<Record<Permiso, Modulo[]>> = {
  'usuarios.gestionar': ['usuarios'],
  'roles.gestionar': ['roles'],
  'proveedores.ver': ['proveedores'],
  'proveedores.crear': ['proveedores'],
  'proveedores.editar': ['proveedores'],
  'proveedores.inactivar': ['proveedores'],
  'pedidos.ver': ['pedidos'],
  'pedidos.crear': ['pedidos'],
  'pedidos.editar': ['pedidos'],
  'pedidos.cancelar': ['pedidos'],
  'caseta.registrar': ['cola'],
  'cola.ver': ['cola'],
  'gateways.ver': ['gateways', 'descargas'],
  'gateways.admin': ['gateways'],
  'descargas.operar': ['descargas'],
  'dashboard.kpis': ['kpis'],
};

/** Funciones fuera del catálogo de módulos: siguen reservadas a los roles base. */
const ROLES_BASE_POR_PERMISO: Partial<Record<Permiso, string[]>> = {
  'parametros.ver': ['administrador'],
  'parametros.editar': ['administrador'],
  'auditoria.ver': ['administrador', 'coordinador'],
};

export interface Sesion {
  rol: string;
  roles: string[];
  permisos: string[];
}

export function tienePermiso(sesion: Sesion | null, permiso: Permiso): boolean {
  if (!sesion) return false;
  const rolesBase = ROLES_BASE_POR_PERMISO[permiso];
  if (rolesBase) return sesion.roles.some((rol) => rolesBase.includes(rol));
  return MODULOS_POR_PERMISO[permiso]?.some((modulo) => sesion.permisos.includes(modulo)) ?? false;
}

interface TokenSesion extends Partial<Sesion> {
  exp?: number;
}

/** Decodifica el JWT; devuelve null si expiró o no trae el formato actual de permisos. */
export function leerSesionDeToken(token: string | null): Sesion | null {
  if (!token) return null;
  try {
    const { rol, roles, permisos, exp } = jwtDecode<TokenSesion>(token);
    if (!rol || !Array.isArray(roles) || !Array.isArray(permisos) || !exp || exp * 1000 <= Date.now()) return null;
    return { rol, roles, permisos };
  } catch {
    return null;
  }
}
