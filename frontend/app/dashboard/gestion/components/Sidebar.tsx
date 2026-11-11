'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useRol } from '../../RolContext';
import type { Permiso } from '../../permisos';

export type PestanaDashboard =
  | 'inicio'
  | 'proveedores'
  | 'pedidos'
  | 'caseta'
  | 'mantenimientos'
  | 'auditoria'
  | 'kpis'
  | 'parametros'
  | 'gateways';

interface SidebarProps {
  abierto: boolean;
  pestanaActiva: PestanaDashboard;
  onNavegar: (pestana: PestanaDashboard) => void;
  onCerrar: () => void;
}

const MENU_ITEMS: Array<{ key: PestanaDashboard; label: string; icon: string; permiso?: Permiso }> = [
  { key: 'inicio', label: 'Inicio', icon: '⌂' },
  { key: 'proveedores', label: 'Proveedores', icon: '▣', permiso: 'proveedores.ver' },
  { key: 'pedidos', label: 'Pedidos', icon: '▤', permiso: 'pedidos.ver' },
  { key: 'caseta', label: 'Caseta', icon: '◫', permiso: 'caseta.registrar' },
  { key: 'gateways', label: 'Gateways', icon: '▦', permiso: 'gateways.ver' },
  { key: 'auditoria', label: 'Auditoría', icon: '◌', permiso: 'auditoria.ver' },
  { key: 'kpis', label: 'Indicadores logísticos', icon: '▥', permiso: 'dashboard.kpis' },
  { key: 'parametros', label: 'Parámetros', icon: '⚙', permiso: 'parametros.ver' },
];

const RUTAS_PROPIAS: Array<{ ruta: string; label: string; icon: string; permiso: Permiso }> = [
  { ruta: '/cola', label: 'Cola de espera', icon: '≡', permiso: 'cola.ver' },
  { ruta: '/usuarios/gestion', label: 'Administrar usuarios', icon: '♙', permiso: 'usuarios.gestionar' },
  { ruta: '/admin/roles', label: 'Catálogo de roles', icon: '⛨', permiso: 'roles.gestionar' },
];

export default function Sidebar({ abierto, pestanaActiva, onNavegar, onCerrar }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { puede } = useRol();
  const enDashboard = pathname === '/dashboard';
  const items = MENU_ITEMS.filter((item) => !item.permiso || puede(item.permiso));

  return (
    <aside
      id="dashboard-sidebar"
      className={`dashboard-sidebar ${abierto ? 'open' : 'closed'}`}
      aria-label="Navegación principal"
    >
      <div className="dashboard-sidebar-header">
        <div className="dashboard-sidebar-brand">LOGÍSTICA</div>
      </div>
      <nav className="dashboard-sidebar-nav">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`dashboard-nav-item ${enDashboard && pestanaActiva === item.key ? 'active' : ''}`}
            aria-current={enDashboard && pestanaActiva === item.key ? 'page' : undefined}
            onClick={() => {
              onNavegar(item.key);
              onCerrar();
            }}
          >
            <span className="dashboard-nav-icon" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
        {RUTAS_PROPIAS.filter((item) => puede(item.permiso)).map((item) => (
          <button
            key={item.ruta}
            type="button"
            className={`dashboard-nav-item ${pathname === item.ruta ? 'active' : ''}`}
            aria-current={pathname === item.ruta ? 'page' : undefined}
            onClick={() => {
              router.push(item.ruta);
              onCerrar();
            }}
          >
            <span className="dashboard-nav-icon" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
