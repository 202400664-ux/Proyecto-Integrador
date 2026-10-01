import { jwtDecode } from 'jwt-decode';

interface DecodedTokenConNombre {
  nombreCompleto?: string;
  exp: number;
}

/**
 * Devuelve el nombre completo del usuario autenticado, leído directamente
 * del JWT (campo `nombreCompleto`, agregado en el login del backend).
 * Se usa para llenar usuarioCreacion/usuarioActualizacion en cada
 * creación/edición, tal como exige la guía del sprint.
 *
 * Cae a 'Sistema' si no hay sesión válida (por ejemplo, en SSR o si el
 * token no trae el campo por venir de una sesión anterior al fix).
 */
export function obtenerNombreUsuarioActual(): string {
  if (typeof window === 'undefined') return 'Sistema';

  const token = localStorage.getItem('token');
  if (!token) return 'Sistema';

  try {
    const decoded = jwtDecode<DecodedTokenConNombre>(token);
    if (decoded.exp * 1000 <= Date.now()) return 'Sistema';
    return decoded.nombreCompleto?.trim() || 'Sistema';
  } catch {
    return 'Sistema';
  }
}