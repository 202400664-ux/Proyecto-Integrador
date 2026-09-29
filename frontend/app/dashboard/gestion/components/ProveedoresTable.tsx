'use client';

import { useState } from 'react';
import type { Proveedor } from '../types';

interface ProveedoresTableProps {
  proveedores: Proveedor[];
  cargando: boolean;
  puedeGestionar: boolean;
  onEditar: (proveedor: Proveedor) => void;
  onInactivar: (id: string) => void;
}

export default function ProveedoresTable({ proveedores, cargando, puedeGestionar, onEditar, onInactivar }: ProveedoresTableProps) {
  const [categoria, setCategoria] = useState('');
  const proveedoresFiltrados = categoria
    ? proveedores.filter((proveedor) => proveedor.categoria === categoria)
    : proveedores;

  return (
    <div className="card p-4 shadow-sm border-0">
      <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-3 mb-3">
        <h2 className="h5 fw-bold mb-0" style={{ color: '#123149' }}>Proveedores registrados</h2>
        <label className="d-flex align-items-center gap-2 mb-0">
          <span className="small fw-semibold">Categoría</span>
          <select className="form-select form-select-sm" value={categoria} onChange={(event) => setCategoria(event.target.value)}>
            <option value="">Todas</option>
            <option value="construcción">Construcción</option>
            <option value="general">General</option>
          </select>
        </label>
      </div>

      {cargando ? (
        <p className="text-secondary mb-0">Cargando proveedores...</p>
      ) : proveedoresFiltrados.length === 0 ? (
        <p className="text-secondary mb-0">Aún no hay proveedores registrados.</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm align-middle">
            <thead>
              <tr>
                <th>Razón social</th>
                <th>Identificación</th>
                <th>Categoría</th>
                <th>Contacto</th>
                <th>Teléfono</th>
                <th>Correo</th>
                <th>Estado</th>
                {puedeGestionar && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {proveedoresFiltrados.map((p) => (
                <tr key={p._id}>
                  <td>{p.razonSocial}</td>
                  <td>{p.identificacionTributaria}</td>
                  <td className="text-capitalize">{p.categoria}</td>
                  <td>{p.contactoNombre}</td>
                  <td>{p.telefono}</td>
                  <td>{p.emailContacto}</td>
                  <td>
                    <span className={`badge ${p.estado === 'activo' ? 'bg-success' : 'bg-secondary'}`}>
                      {p.estado}
                    </span>
                  </td>
                  {puedeGestionar && (
                    <td className="text-nowrap">
                      <button type="button" className="btn btn-sm btn-outline-primary me-2" onClick={() => onEditar(p)}>
                        Editar
                      </button>
                      <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onInactivar(p._id)}>
                        Inactivar
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}