'use client';

import type { Rol } from '../../permisos';

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
  rol: Rol;
  abierto: boolean;
  pestanaActiva: PestanaDashboard;
  onNavegar: (pestana: PestanaDashboard) => void;
  onCerrar: () => void;
}

const MENU_ITEMS: Array<{ key: PestanaDashboard; label: string; icon: string }> = [
  { key: 'inicio', label: 'Inicio', icon: '⌂' },
  { key: 'proveedores', label: 'Proveedores', icon: '▣' },
  { key: 'pedidos', label: 'Pedidos', icon: '▤' },
  { key: 'caseta', label: 'Caseta', icon: '◫' },
  { key: 'gateways', label: 'Gateways', icon: '▦' },
  { key: 'auditoria', label: 'Auditoría', icon: '◌' },
  { key: 'kpis', label: 'Indicadores logísticos', icon: '▥' },
];

export default function Sidebar({ rol, abierto, pestanaActiva, onNavegar, onCerrar }: SidebarProps) {
  const items = [
    ...MENU_ITEMS.filter((item) => {
      if (item.key === 'auditoria') return rol !== 'operador';
      if (item.key === 'kpis') return rol === 'administrador' || rol === 'coordinador';
      return true;
    }),
    ...(rol === 'administrador' ? [{ key: 'parametros' as const, label: 'Parámetros', icon: '⚙' }] : []),
  ];

  return (
    <aside
      id="dashboard-sidebar"
      className={`dashboard-sidebar ${abierto ? 'open' : 'closed'}`}
      aria-label="Navegación principal"
      aria-hidden={!abierto}
    >
      <div className="dashboard-sidebar-header">
        <div className="dashboard-sidebar-brand">LOGÍSTICA</div>
      </div>
      <nav className="dashboard-sidebar-nav">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`dashboard-nav-item ${pestanaActiva === item.key ? 'active' : ''}`}
            aria-current={pestanaActiva === item.key ? 'page' : undefined}
            tabIndex={abierto ? 0 : -1}
            onClick={() => {
              onNavegar(item.key);
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