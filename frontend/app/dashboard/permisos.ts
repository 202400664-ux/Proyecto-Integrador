export type Rol = 'administrador' | 'coordinador' | 'operador';

/**
 * Cada acción del sistema se identifica con un permiso ("recurso.accion").
 * La interfaz es la MISMA para todos los roles; lo único que cambia es qué
 * acciones puede ejecutar cada rol, controlado desde este único lugar.
 */
export type Permiso =
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
  | 'mantenimientos.ver'
  | 'mantenimientos.crear'
  | 'auditoria.ver';

const PERMISOS_POR_ROL: Record<Rol, Permiso[]> = {
  administrador: [
    'proveedores.ver',
    'proveedores.crear',
    'proveedores.editar',
    'proveedores.inactivar',
    'pedidos.ver',
    'pedidos.crear',
    'pedidos.editar',
    'pedidos.cancelar',
    'parametros.ver',
    'parametros.editar',
    'caseta.registrar',
    'mantenimientos.ver',
    'mantenimientos.crear',
    'auditoria.ver',
  ],
  coordinador: [
    'proveedores.ver',
    'proveedores.crear',
    'proveedores.editar',
    'proveedores.inactivar',
    'pedidos.ver',
    'pedidos.crear',
    'pedidos.editar',
    'pedidos.cancelar',
    'caseta.registrar',
    'mantenimientos.ver',
    'mantenimientos.crear',
    'auditoria.ver',
  ],
  operador: [
    'proveedores.ver',
    'pedidos.ver',
    'mantenimientos.ver',
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