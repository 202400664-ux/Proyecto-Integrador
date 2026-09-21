'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';
import { esRolValido, type Rol } from './permisos';
import { RolProvider } from './RolContext';

interface DecodedToken {
  rol: Rol;
  exp: number;
}

const removeStoredSession = () => {
  localStorage.removeItem('token');
};

const getRoleLabel = (role: Rol) => role.charAt(0).toUpperCase() + role.slice(1);

const readRoleFromToken = (): Rol | null => {
  if (typeof window === 'undefined') return null;

  const token = localStorage.getItem('token');
  if (!token) return null;

  try {
    const decoded = jwtDecode<DecodedToken>(token);
    if (!esRolValido(decoded.rol) || decoded.exp * 1000 <= Date.now()) {
      return null;
    }

    return decoded.rol;
  } catch {
    return null;
  }
};

const subscribeToSession = (callback: () => void) => {
  window.addEventListener('storage', callback);
  window.addEventListener('sessionchange', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('sessionchange', callback);
  };
};

const handleBackNavigation = (router: ReturnType<typeof useRouter>) => {
  if (readRoleFromToken()) {
    window.history.pushState(null, '', window.location.href);
  } else {
    router.replace('/');
  }
};

interface RoleDashboardProps {
  children?: React.ReactNode;
}

/**
 * Dashboard ÚNICO para todos los roles autenticados (administrador,
 * coordinador, operador). No existe una interfaz distinta por rol: el rol
 * se decodifica del único JWT y se expone vía RolProvider para que los
 * componentes hijos limiten qué ACCIONES mostrar (ver permisos.ts),
 * en lugar de tener una pantalla completa por cada rol.
 */
export default function RoleDashboard({ children }: RoleDashboardProps) {
  const rol = useSyncExternalStore(subscribeToSession, readRoleFromToken, () => null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const currentRole = readRoleFromToken();

    if (!token || !currentRole) {
      removeStoredSession();
      router.replace('/');
      return;
    }

    window.history.pushState(null, '', window.location.href);
    const onPopState = () => handleBackNavigation(router);
    window.addEventListener('popstate', onPopState);

    return () => window.removeEventListener('popstate', onPopState);
  }, [router]);

  const handleLogout = () => {
    removeStoredSession();
    window.dispatchEvent(new Event('sessionchange'));
    window.history.replaceState(null, '', '/');
    router.replace('/');
  };

  if (!rol) return null;

  return (
    <RolProvider rol={rol}>
      <div className="min-vh-100 bg-light">
        <header className="border-bottom bg-white shadow-sm">
          <div className="container py-3 d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
            <div>
              <p className="text-uppercase text-primary fw-semibold small mb-1">
                Centro de distribución
              </p>
              <h1 className="h4 fw-bold text-dark mb-0">
                Sistema de Gestión Logística - Recepción y Desembarque
              </h1>
              <p className="text-secondary mb-0 mt-1">
                Rol: {getRoleLabel(rol)}
              </p>
            </div>
            <button onClick={handleLogout} className="btn btn-outline-danger flex-shrink-0">
              Cerrar Sesión
            </button>
          </div>
        </header>

        <main className="container min-vh-100 py-4">{children}</main>
      </div>
    </RolProvider>
  );
}