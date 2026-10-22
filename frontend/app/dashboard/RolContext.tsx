'use client';

import { createContext, useContext } from 'react';
import { tienePermiso, type Permiso, type Rol } from './permisos';

interface RolContextValue {
  rol: Rol | null;
  puede: (permiso: Permiso) => boolean;
}

const RolContext = createContext<RolContextValue>({ rol: null, puede: () => false });

export function RolProvider({ rol, children }: { rol: Rol | null; children: React.ReactNode }) {
  const value: RolContextValue = { rol, puede: (permiso) => tienePermiso(rol, permiso) };
  return <RolContext.Provider value={value}>{children}</RolContext.Provider>;
}

/** Hook para leer el rol actual y validar permisos dentro de cualquier componente del dashboard. */
export function useRol() {
  return useContext(RolContext);
}