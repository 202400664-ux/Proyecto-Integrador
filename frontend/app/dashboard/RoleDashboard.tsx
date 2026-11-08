'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { leerSesionDeToken, tienePermiso, type Permiso } from './permisos';
import { RolProvider } from './RolContext';
import Sidebar, { type PestanaDashboard } from './gestion/components/Sidebar';

const removeStoredSession = () => {
  localStorage.removeItem('token');
};

const getRoleLabel = (role: string) => role.charAt(0).toUpperCase() + role.slice(1);

const readValidToken = (): string | null => {
  if (typeof window === 'undefined') return null;

  const token = localStorage.getItem('token');
  return leerSesionDeToken(token) ? token : null;
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
  if (readValidToken()) {
    window.history.pushState(null, '', window.location.href);
  } else {
    router.replace('/');
  }
};

interface RoleDashboardProps {
  children?: React.ReactNode;
  /** Si se indica, la página solo muestra su contenido a quien tenga este permiso. */
  requierePermiso?: Permiso;
}

/**
 * Dashboard ÚNICO para todos los roles autenticados (administrador,
 * coordinador, operador). No existe una interfaz distinta por rol: el rol
 * se decodifica del único JWT y se expone vía RolProvider para que los
 * componentes hijos limiten qué ACCIONES mostrar (ver permisos.ts),
 * en lugar de tener una pantalla completa por cada rol.
 */
export default function RoleDashboard({ children, requierePermiso }: RoleDashboardProps) {
  const tokenSesion = useSyncExternalStore(subscribeToSession, readValidToken, () => null);
  const sesion = useMemo(() => leerSesionDeToken(tokenSesion), [tokenSesion]);
  const rol = sesion?.rol ?? null;
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pestanaActiva, setPestanaActiva] = useState<PestanaDashboard>('inicio');
  const [navegacionSeleccionada, setNavegacionSeleccionada] = useState(false);
  const pestanaVisible = rol === 'coordinador' && !navegacionSeleccionada ? 'gateways' : pestanaActiva;

  useEffect(() => {
    const token = localStorage.getItem('token');

    if (!token || !readValidToken()) {
      removeStoredSession();
      router.replace('/');
      return;
    }

    window.history.pushState(null, '', window.location.href);
    const onPopState = () => handleBackNavigation(router);
    window.addEventListener('popstate', onPopState);

    return () => window.removeEventListener('popstate', onPopState);
  }, [router]);

  useEffect(() => {
    const onShowHome = () => {
      setNavegacionSeleccionada(true);
      setPestanaActiva('inicio');
    };
    const onSelectTab = (event: Event) => {
      const pestana = (event as CustomEvent<PestanaDashboard>).detail;
      if (pestana) {
        setNavegacionSeleccionada(true);
        setPestanaActiva(pestana);
      }
    };

    window.addEventListener('dashboard:show-home', onShowHome);
    window.addEventListener('dashboard:select-tab', onSelectTab as EventListener);
    const requestedTab = new URLSearchParams(window.location.search).get('tab');
    const validTabs: PestanaDashboard[] = [
      'inicio',
      'proveedores',
      'pedidos',
      'caseta',
      'mantenimientos',
      'auditoria',
      'kpis',
      'parametros',
      'gateways',
    ];
    const timer = window.setTimeout(() => {
      if (requestedTab && validTabs.includes(requestedTab as PestanaDashboard)) {
        window.dispatchEvent(new CustomEvent('dashboard:select-tab', { detail: requestedTab }));
      }
    }, 0);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('dashboard:show-home', onShowHome);
      window.removeEventListener('dashboard:select-tab', onSelectTab as EventListener);
    };
  }, []);

  const handleLogout = () => {
    removeStoredSession();
    window.dispatchEvent(new Event('sessionchange'));
    window.history.replaceState(null, '', '/');
    router.replace('/');
  };

  const navegar = (pestana: PestanaDashboard) => {
    if (pathname !== '/dashboard') {
      router.push(`/dashboard?tab=${encodeURIComponent(pestana)}`);
      setSidebarOpen(false);
      return;
    }

    setNavegacionSeleccionada(true);
    setPestanaActiva(pestana);
    if (pestana === 'inicio') {
      window.dispatchEvent(new Event('dashboard:show-home'));
    } else {
      window.dispatchEvent(new CustomEvent('dashboard:select-tab', { detail: pestana }));
    }
  };

  if (!sesion) return null;

  return (
    <RolProvider sesion={sesion}>
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
                <strong>{sesion.roles.map(getRoleLabel).join(', ')}</strong>
              </div>
              <button onClick={handleLogout} className="dashboard-logout-btn">
                Cerrar Sesión
              </button>
            </div>
          </div>
        </header>

        <main className={`dashboard-main dashboard-layout ${sidebarOpen ? 'sidebar-expanded' : ''}`}>
          <Sidebar
            abierto={sidebarOpen}
            pestanaActiva={pestanaVisible}
            onNavegar={navegar}
            onCerrar={() => setSidebarOpen(false)}
          />

          <div className="dashboard-panel">
            {requierePermiso && !tienePermiso(sesion, requierePermiso) ? (
              <div className="alert alert-danger" role="alert">
                <strong>Acceso no autorizado.</strong> Sus roles no tienen habilitado este módulo.
              </div>
            ) : children}
          </div>
        </main>
      </div>
    </RolProvider>
  );
}