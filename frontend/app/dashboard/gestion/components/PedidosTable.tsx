import type { Pedido, ProveedorRef } from '../types';

interface PedidosTableProps {
  pedidos: Pedido[];
  proveedores: ProveedorRef[];
  cargando: boolean;
}

function nombreProveedor(proveedorId: Pedido['proveedorId'], proveedores: ProveedorRef[]): string {
  if (typeof proveedorId === 'string') {
    return proveedores.find((proveedor) => proveedor._id === proveedorId)?.razonSocial ?? proveedorId;
  }
  return (proveedorId as ProveedorRef).razonSocial;
}

function formatoLegible(iso: string): string {
  return new Date(iso).toLocaleString('es-SV', { dateStyle: 'medium', timeStyle: 'short' });
}

const badgeEstado: Record<Pedido['estado'], string> = {
  PROGRAMADO: 'bg-primary',
  CANCELADO: 'bg-danger',
  COMPLETADO: 'bg-success',
};

export default function PedidosTable({ pedidos, proveedores, cargando }: PedidosTableProps) {
  return (
    <div className="card p-4 shadow-sm border-0">
      <h2 className="h5 fw-bold mb-3" style={{ color: '#123149' }}>
        Pedidos programados
      </h2>

      {cargando ? (
        <p className="text-secondary mb-0">Cargando pedidos...</p>
      ) : pedidos.length === 0 ? (
        <p className="text-secondary mb-0">Aún no hay pedidos programados.</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm align-middle">
            <thead>
              <tr>
                <th>N° Pedido</th>
                <th>Proveedor</th>
                <th>Tipo</th>
                <th>Ventana</th>
                <th>Duración</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p._id}>
                  <td>{p.numeroPedido}</td>
                  <td>{nombreProveedor(p.proveedorId, proveedores)}</td>
                  <td className="text-capitalize">{p.tipoProducto}</td>
                  <td>
                    {formatoLegible(p.inicioVentana)} - {formatoLegible(p.finVentana)}
                  </td>
                  <td>{p.duracionEstimadaMinutos} min</td>
                  <td>
                    <span className={`badge ${badgeEstado[p.estado]}`}>{p.estado}</span>
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