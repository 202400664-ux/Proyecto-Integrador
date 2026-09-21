import type { Proveedor } from '../types';

interface ProveedoresTableProps {
  proveedores: Proveedor[];
  cargando: boolean;
}

export default function ProveedoresTable({ proveedores, cargando }: ProveedoresTableProps) {
  return (
    <div className="card p-4 shadow-sm border-0">
      <h2 className="h5 fw-bold mb-3" style={{ color: '#123149' }}>
        Proveedores registrados
      </h2>

      {cargando ? (
        <p className="text-secondary mb-0">Cargando proveedores...</p>
      ) : proveedores.length === 0 ? (
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}