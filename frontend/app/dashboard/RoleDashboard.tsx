'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';
import { esRolValido, type Rol } from './permisos';
import { RolProvider } from './RolContext';

const MENU_ITEMS = [
  { key: 'inicio', label: 'Inicio', icon: '⌂' },
  { key: 'proveedores', label: 'Proveedores', icon: '▣' },
  { key: 'pedidos', label: 'Pedidos', icon: '▤' },
  { key: 'caseta', label: 'Caseta', icon: '◫' },
  { key: 'gateways', label: 'Gateways', icon: '▥' },
  { key: 'mantenimientos', label: 'Mantenimientos', icon: '◧' },
  { key: 'auditoria', label: 'Auditoría', icon: '◌' },
] as const;

const PARAMETROS_MENU_ITEM = { key: 'parametros', label: 'Parámetros', icon: '⚙' } as const;

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
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
      <div className="dashboard-shell">
        <header className="dashboard-topbar">
          <div className="dashboard-header-inner">
            <div className="dashboard-brand-block">
              <button
                type="button"
                className="dashboard-menu-button"
                aria-label={sidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
                aria-expanded={sidebarOpen}
                aria-controls="dashboard-sidebar"
                onClick={() => setSidebarOpen((prev) => !prev)}
              >
                <span />
                <span />
                <span />
              </button>

              <div className="dashboard-title-wrap">
                <span className="dashboard-kicker">Centro de distribución</span>
                <h1>Sistema de Gestión Logística</h1>
                <p>Recepción y desembarque de proveedores</p>
              </div>
            </div>

            <div className="dashboard-user-panel">
              <div className="dashboard-user-meta">
                <span className="dashboard-rol-label">Rol</span>
                <strong>{getRoleLabel(rol)}</strong>
              </div>
              <button onClick={handleLogout} className="dashboard-logout-btn">
                Cerrar Sesión
              </button>
            </div>
          </div>
        </header>

        <main className={`dashboard-main dashboard-layout ${sidebarOpen ? 'sidebar-expanded' : 'sidebar-collapsed'}`}>
          <aside id="dashboard-sidebar" className={`dashboard-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
            <div className="dashboard-sidebar-header">
              <div className="dashboard-sidebar-brand">LOGÍSTICA</div>
            </div>

            <nav className="dashboard-sidebar-nav">
              {[...MENU_ITEMS, ...(rol === 'administrador' ? [PARAMETROS_MENU_ITEM] : [])].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className="dashboard-nav-item"
                  onClick={() => {
                    if (item.key === 'inicio') {
                      window.dispatchEvent(new Event('dashboard:show-home'));
                    } else {
                      window.dispatchEvent(new CustomEvent('dashboard:select-tab', { detail: item.key }));
                    }
                  }}
                >
                  <span className="dashboard-nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </aside>

          <div className="dashboard-panel">{children}</div>
        </main>
      </div>
    </RolProvider>
  );
}