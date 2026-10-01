import type { Pedido, ProveedorRef } from '../types';

interface PedidosTableProps {
  pedidos: Pedido[];
  proveedores: ProveedorRef[];
  cargando: boolean;
  puedeEditar: boolean;
  puedeCancelar: boolean;
  onEditar: (pedido: Pedido) => void;
  onCancelar: (id: string) => void;
}

function nombreProveedor(proveedorId: Pedido['proveedorId'], proveedores: ProveedorRef[]): string {
  if (!proveedorId) return 'Proveedor no disponible';
  if (typeof proveedorId === 'string') {
    return proveedores.find((proveedor) => proveedor._id === proveedorId)?.razonSocial ?? proveedorId;
  }
  return (proveedorId as ProveedorRef).razonSocial;
}

function formatoLegible(iso: string): string {
  return new Date(iso).toLocaleString('es-SV', { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * Calcula dinámicamente el estado y el badge según:
 * 1. Si ya se registró la llegada en caseta (A TIEMPO, TARDÍO, ANTICIPADO).
 * 2. Si NO se ha registrado llegada y la ventana ya venció (AUSENTE).
 * 3. Si NO se ha registrado llegada pero aún está en plazo (PROGRAMADO).
 */
function obtenerInfoEstado(p: Pedido): { texto: string; clase: string } {
  const fechaLlegada = p.fechaHoraLlegadaReal;

  // Si ya tiene registrada fecha/hora de llegada real
  if (fechaLlegada) {
    const estadoLlegada = String(p.estado || 'COMPLETADO');
    switch (estadoLlegada) {
      case 'A TIEMPO':
      case 'COMPLETADO':
        return { texto: estadoLlegada, clase: 'bg-success' };
      case 'ANTICIPADO':
        return { texto: estadoLlegada, clase: 'bg-warning text-dark' };
      case 'TARDÍO':
        return { texto: estadoLlegada, clase: 'bg-danger' };
      default:
        return { texto: estadoLlegada, clase: 'bg-secondary' };
    }
  }

  if (p.estado === 'CANCELADO') {
    return { texto: 'CANCELADO', clase: 'bg-danger' };
  }

  if (p.estado === 'AUSENTE') {
    return { texto: 'AUSENTE', clase: 'bg-danger' };
  }

  // Si no se ha registrado llegada, revisamos si la ventana de entrega ya expiró
  const ahora = new Date();
  const finVentana = new Date(p.finVentana);

  if (ahora > finVentana) {
    return { texto: 'AUSENTE', clase: 'bg-danger' };
  }

  return { texto: 'PROGRAMADO', clase: 'bg-primary' };
}

export default function PedidosTable({ pedidos, proveedores, cargando, puedeEditar, puedeCancelar, onEditar, onCancelar }: PedidosTableProps) {
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
                {(puedeEditar || puedeCancelar) && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => {
                const infoEstado = obtenerInfoEstado(p);
                const yaEntregado = Boolean(p.fechaHoraLlegadaReal) || ['ANTICIPADO', 'A TIEMPO', 'TARDÍO'].includes(p.estado);
                return (
                  <tr key={p._id}>
                    <td>{p.numeroPedido}</td>
                    <td>{nombreProveedor(p.proveedorId, proveedores)}</td>
                    <td className="text-capitalize">{p.tipoProducto}</td>
                    <td>
                      {formatoLegible(p.inicioVentana)} - {formatoLegible(p.finVentana)}
                    </td>
                    <td>{p.duracionEstimadaMinutos} min</td>
                    <td>
                      <span className={`badge ${infoEstado.clase}`}>
                        {infoEstado.texto}
                      </span>
                    </td>
                    {(puedeEditar || puedeCancelar) && (
                      <td className="text-nowrap">
                        {yaEntregado ? (
                          <small className="text-secondary fw-semibold">Ya entregado</small>
                        ) : (
                          <>
                            {puedeEditar && <button type="button" className="btn btn-sm btn-outline-primary me-2" onClick={() => onEditar(p)}>Editar</button>}
                            {puedeCancelar && <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onCancelar(p._id)}>Cancelar</button>}
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}