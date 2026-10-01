import type { Proveedor } from '../types';

interface ProveedoresTableProps {
  proveedores: Proveedor[];
  cargando: boolean;
  categoriaFiltro: string;
  onCategoriaFiltroChange: (categoria: string) => void;
  puedeEditar: boolean;
  puedeInactivar: boolean;
  onEditar: (proveedor: Proveedor) => void;
  onInactivar: (id: string) => void;
}

export default function ProveedoresTable({ proveedores, cargando, categoriaFiltro, onCategoriaFiltroChange, puedeEditar, puedeInactivar, onEditar, onInactivar }: ProveedoresTableProps) {
  return (
    <div className="card p-4 shadow-sm border-0">
      <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-3 mb-3">
        <h2 className="h5 fw-bold mb-0" style={{ color: '#123149' }}>Proveedores registrados</h2>
        <div className="d-flex align-items-center gap-2">
          <label htmlFor="filtro-categoria-proveedor" className="form-label mb-0">Categoría</label>
          <select
            id="filtro-categoria-proveedor"
            className="form-select"
            value={categoriaFiltro}
            onChange={(event) => onCategoriaFiltroChange(event.target.value)}
          >
            <option value="">Todas</option>
            <option value="construcción">Construcción</option>
            <option value="general">General</option>
          </select>
        </div>
      </div>

      {cargando ? (
        <p className="text-secondary mb-0">Cargando proveedores...</p>
      ) : proveedores.length === 0 ? (
        <p className="text-secondary mb-0">{categoriaFiltro ? 'No hay proveedores en esta categoría.' : 'Aún no hay proveedores registrados.'}</p>
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
                {(puedeEditar || puedeInactivar) && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {proveedores.map((p) => (
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
                  {(puedeEditar || puedeInactivar) && (
                    <td className="text-nowrap">
                      {puedeEditar && <button type="button" className="btn btn-sm btn-outline-primary me-2" onClick={() => onEditar(p)}>Editar</button>}
                      {puedeInactivar && <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onInactivar(p._id)}>Inactivar</button>}
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