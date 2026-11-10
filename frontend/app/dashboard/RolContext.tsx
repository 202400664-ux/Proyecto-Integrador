'use client';

import { createContext, useContext } from 'react';
import { tienePermiso, type Permiso, type Sesion } from './permisos';

interface RolContextValue {
  rol: string | null;
  puede: (permiso: Permiso) => boolean;
}

const RolContext = createContext<RolContextValue>({ rol: null, puede: () => false });

export function RolProvider({ sesion, children }: { sesion: Sesion | null; children: React.ReactNode }) {
  const value: RolContextValue = { rol: sesion?.rol ?? null, puede: (permiso) => tienePermiso(sesion, permiso) };
  return <RolContext.Provider value={value}>{children}</RolContext.Provider>;
}

/** Hook para leer el rol actual y validar permisos dentro de cualquier componente del dashboard. */
export function useRol() {
  return useContext(RolContext);
}
