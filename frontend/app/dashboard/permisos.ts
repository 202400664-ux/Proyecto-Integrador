export type Rol = 'administrador' | 'coordinador' | 'operador';

/**
 * Cada acción del sistema se identifica con un permiso ("recurso.accion").
 * La interfaz es la MISMA para todos los roles; lo único que cambia es qué
 * acciones puede ejecutar cada rol, controlado desde este único lugar.
 */
export type Permiso =
  | 'proveedores.ver'
  | 'proveedores.crear'
  | 'pedidos.ver'
  | 'pedidos.crear'
  | 'parametros.ver'
  | 'parametros.editar'
  | 'caseta.registrar'
  | 'mantenimientos.ver'
  | 'mantenimientos.crear'
  | 'auditoria.ver'
  | 'gateways.ver'
  | 'gateways.admin'
  | 'descargas.operar';

const PERMISOS_POR_ROL: Record<Rol, Permiso[]> = {
  administrador: [
    'proveedores.ver',
    'proveedores.crear',
    'pedidos.ver',
    'pedidos.crear',
    'parametros.ver',
    'parametros.editar',
    'caseta.registrar',
    'mantenimientos.ver',
    'mantenimientos.crear',
    'auditoria.ver',
    'gateways.ver',
    'gateways.admin',
    'descargas.operar',
  ],
  coordinador: [
    'proveedores.ver',
    'proveedores.crear',
    'pedidos.ver',
    'pedidos.crear',
    'caseta.registrar',
    'mantenimientos.ver',
    'mantenimientos.crear',
    'auditoria.ver',
    'gateways.ver',
    'descargas.operar',
  ],
  operador: [
    'proveedores.ver',
    'pedidos.ver',
    'mantenimientos.ver',
    'auditoria.ver',
    'gateways.ver',
  ],
};

export function tienePermiso(rol: Rol | null, permiso: Permiso): boolean {
  if (!rol) return false;
  return PERMISOS_POR_ROL[rol]?.includes(permiso) ?? false;
}

export const ROLES_VALIDOS: Rol[] = ['administrador', 'coordinador', 'operador'];

export function esRolValido(valor: unknown): valor is Rol {
  return typeof valor === 'string' && (ROLES_VALIDOS as string[]).includes(valor);
}