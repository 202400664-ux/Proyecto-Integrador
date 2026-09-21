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
  | 'pedidos.crear';

const PERMISOS_POR_ROL: Record<Rol, Permiso[]> = {
  administrador: ['proveedores.ver', 'proveedores.crear', 'pedidos.ver', 'pedidos.crear'],
  coordinador: ['proveedores.ver', 'proveedores.crear', 'pedidos.ver', 'pedidos.crear'],
  // Supuesto de negocio: el operador consulta proveedores y pedidos pero no
  // los crea (esa responsabilidad es del coordinador/administrador). Ajustar
  // aquí si el rol debe tener más o menos acceso.
  operador: ['proveedores.ver', 'pedidos.ver'],
};

export function tienePermiso(rol: Rol | null, permiso: Permiso): boolean {
  if (!rol) return false;
  return PERMISOS_POR_ROL[rol]?.includes(permiso) ?? false;
}

export const ROLES_VALIDOS: Rol[] = ['administrador', 'coordinador', 'operador'];

export function esRolValido(valor: unknown): valor is Rol {
  return typeof valor === 'string' && (ROLES_VALIDOS as string[]).includes(valor);
}