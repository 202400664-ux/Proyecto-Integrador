'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  cambiarEstadoGateway,
  encolarPedido,
  finalizarDescarga,
  inactivarGateway,
  iniciarDescarga,
  obtenerColaPrioridad,
  obtenerDescargasActivas,
  obtenerGateways,
  obtenerGatewaysInactivos,
  obtenerNotificaciones,
  obtenerPedidos,
  reevaluarColaPrioridad,
  reactivarGateway,
} from '../api';
import type { DescargaActiva, Gateway, Notificacion, Pedido } from '../types';

interface GatewaysPanelProps {
  puedeAdministrar: boolean;
  puedeOperar: boolean;
}

const claseEstado: Record<Gateway['estado'], string> = {
  LIBRE: 'gateway-free',
  OCUPADO: 'gateway-busy',
  'FUERA DE SERVICIO': 'gateway-offline',
};

type PedidoEnCola = Pedido & { minutosEnCola: number | null };

export default function GatewaysPanel({ puedeAdministrar, puedeOperar }: GatewaysPanelProps) {
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [gatewaysInactivos, setGatewaysInactivos] = useState<Gateway[]>([]);
  const [cola, setCola] = useState<PedidoEnCola[]>([]);
  const [descargas, setDescargas] = useState<DescargaActiva[]>([]);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState('');
  const [pedidoPorGateway, setPedidoPorGateway] = useState<Record<string, string>>({});
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const cargar = useCallback(async () => {
    try {
      const [listaGateways, listaCola, listaDescargas, listaInactivos, listaNotificaciones, listaPedidos] = await Promise.all([
        obtenerGateways(),
        obtenerColaPrioridad(),
        obtenerDescargasActivas(),
        puedeAdministrar ? obtenerGatewaysInactivos() : Promise.resolve([]),
        obtenerNotificaciones(),
        obtenerPedidos(),
      ]);
      setGateways(listaGateways);
      setPedidos(listaPedidos);
      const ahora = Date.now();
      setCola(listaCola.map((pedido) => ({
        ...pedido,
        minutosEnCola: pedido.fechaEntradaCola
          ? Math.floor((ahora - new Date(pedido.fechaEntradaCola).getTime()) / 60000)
          : null,
      })));
      setDescargas(listaDescargas);
      setGatewaysInactivos(listaInactivos);
      setNotificaciones(listaNotificaciones);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el tablero de gateways');
    } finally {
      setCargando(false);
    }
  }, [puedeAdministrar]);

  useEffect(() => {
    const cargaInicial = window.setTimeout(() => void cargar(), 0);
    const intervalo = window.setInterval(() => void cargar(), 5000);
    return () => {
      window.clearTimeout(cargaInicial);
      window.clearInterval(intervalo);
    };
  }, [cargar]);

  const ejecutar = async (clave: string, accion: () => Promise<void>) => {
    setProcesando(clave);
    setError('');
    try {
      await accion();
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'La operación no se pudo completar');
    } finally {
      setProcesando('');
    }
  };

  const actualizarTablero = async () => {
    setActualizando(true);
    setError('');
    setMensaje('');
    try {
      await reevaluarColaPrioridad();
      await cargar();
      setMensaje('Tablero actualizado y cola reevaluada.');
      window.setTimeout(() => setMensaje(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo reevaluar la cola');
    } finally {
      setActualizando(false);
    }
  };

  if (cargando) return <div className="card p-4">Cargando gateways y cola...</div>;

  return (
    <section className="gateways-workspace">
      <header className="gateways-heading">
        <div>
          <p className="text-uppercase small fw-bold mb-1 text-warning">Operación de patio</p>
          <h2 className="h4 mb-1">Gateways de descarga</h2>
          <p className="text-secondary mb-0">Disponibilidad, asignación y avance de descargas</p>
        </div>
        <button type="button" className="btn btn-outline-primary" disabled={actualizando} onClick={() => void actualizarTablero()}>
          {actualizando ? 'Actualizando...' : 'Actualizar'}
        </button>
      </header>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {mensaje && <div className="alert alert-success py-2" role="status">{mensaje}</div>}

      {notificaciones.length > 0 && (
        <div className="gateway-notifications" aria-live="polite">
          <h3 className="h6 mb-2">Avisos operativos</h3>
          {notificaciones.slice(0, 4).map((notificacion) => (
            <div className="gateway-notification" key={notificacion._id}>
              <strong>{notificacion.titulo}</strong>
              <span>{notificacion.mensaje}</span>
              <small>{new Date(notificacion.fechaCreacion).toLocaleString('es-SV', { dateStyle: 'short', timeStyle: 'short' })}</small>
            </div>
          ))}
        </div>
      )}

      <div className="gateway-grid">
        {gateways.map((gateway) => {
          const asignado = gateway.pedidoAsignado;
          const descarga = descargas.find((item) => item.gatewayId._id === gateway._id);
          const clave = String(gateway._id);
          const pedidosElegibles = pedidos.filter((pedido) =>
            ['ANTICIPADO', 'A TIEMPO', 'TARDÍO'].includes(pedido.estado) &&
            pedido.tipoProducto === gateway.tipoCargaPermitida &&
            !pedido.gatewayId
          );
          const pedidoSeleccionadoDisponible = pedidosElegibles.some(
            (pedido) => pedido._id === pedidoPorGateway[gateway._id]
          );
          return (
            <article className={`gateway-card ${claseEstado[gateway.estado]}`} key={gateway._id}>
              <div className="gateway-card-head">
                <div>
                  <span className="gateway-number">{String(gateway.numeroGateway).padStart(2, '0')}</span>
                  <h3>Gateway {gateway.numeroGateway}</h3>
                </div>
                <span className="gateway-state">{gateway.estado}</span>
              </div>
              <p className="gateway-cargo">Carga permitida: <strong>{gateway.tipoCargaPermitida}</strong></p>

              {asignado ? (
                <div className="gateway-assignment">
                  <span className="small text-uppercase fw-bold">Pedido asignado</span>
                  <strong>{asignado.numeroPedido}</strong>
                  <span>{asignado.tipoProducto} · {asignado.estado.replaceAll('_', ' ')}</span>
                </div>
              ) : gateway.estado === 'OCUPADO' ? (
                <div className="gateway-assignment">
                  <span className="small text-uppercase fw-bold">Descarga en curso</span>
                  <strong>{descarga?.pedidoId.numeroPedido ?? 'Pedido en proceso'}</strong>
                </div>
              ) : (
                <div className="gateway-assignment gateway-empty">Sin pedido asignado</div>
              )}

              {puedeOperar && gateway.estado === 'LIBRE' && pedidosElegibles.length > 0 && (
                <div className="gateway-queue-entry">
                  <label className="form-label small mb-1" htmlFor={`pedido-${gateway._id}`}>Pedido elegible</label>
                  <select
                    id={`pedido-${gateway._id}`}
                    className="form-select form-select-sm"
                    value={pedidoPorGateway[gateway._id] ?? ''}
                    onChange={(event) => setPedidoPorGateway((actual) => ({ ...actual, [gateway._id]: event.target.value }))}
                  >
                    <option value="">Seleccionar pedido</option>
                    {pedidosElegibles.map((pedido) => (
                      <option key={pedido._id} value={pedido._id}>
                        {pedido.numeroPedido} · {pedido.estado}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary w-100 mt-2"
                    disabled={!pedidoSeleccionadoDisponible || procesando === `cola-${gateway._id}`}
                    onClick={() => void ejecutar(`cola-${gateway._id}`, async () => {
                      await encolarPedido(pedidoPorGateway[gateway._id]);
                      setPedidoPorGateway((actual) => ({ ...actual, [gateway._id]: '' }));
                    })}
                  >
                    {procesando === `cola-${gateway._id}` ? 'Encolando...' : 'Agregar a cola priorizada'}
                  </button>
                </div>
              )}

              {puedeOperar && gateway.estado === 'LIBRE' && asignado && (
                <button
                  type="button"
                  className="btn btn-primary w-100 mt-3"
                  disabled={procesando === clave}
                  onClick={() => void ejecutar(clave, () => iniciarDescarga(asignado._id, gateway._id))}
                >
                  {procesando === clave ? 'Iniciando...' : 'Iniciar descarga'}
                </button>
              )}
              {puedeOperar && gateway.estado === 'OCUPADO' && descarga && (
                <button
                  type="button"
                  className="btn btn-light w-100 mt-3"
                  disabled={procesando === clave}
                  onClick={() => void ejecutar(clave, () => finalizarDescarga(descarga._id))}
                >
                  {procesando === clave ? 'Finalizando...' : 'Finalizar descarga'}
                </button>
              )}
              {puedeAdministrar && gateway.estado !== 'OCUPADO' && !gateway.pedidoAsignadoId && (
                <div className="d-flex flex-wrap gap-2 mt-3">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-dark"
                    disabled={procesando === clave}
                    onClick={() => void ejecutar(clave, () => cambiarEstadoGateway(
                      gateway._id,
                      gateway.estado === 'LIBRE' ? 'FUERA DE SERVICIO' : 'LIBRE'
                    ))}
                  >
                    {gateway.estado === 'LIBRE' ? 'Sacar de servicio' : 'Habilitar'}
                  </button>
                  {gateway.numeroGateway !== 5 && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      disabled={procesando === clave}
                      onClick={() => {
                        if (window.confirm(`¿Inactivar Gateway ${gateway.numeroGateway}? Se conservará en la base de datos.`)) {
                          void ejecutar(clave, () => inactivarGateway(gateway._id));
                        }
                      }}
                    >
                      Inactivar
                    </button>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {puedeAdministrar && gatewaysInactivos.length > 0 && (
        <div className="queue-panel">
          <h3 className="h5 mb-3">Gateways inactivos</h3>
          <div className="d-flex flex-wrap gap-2">
            {gatewaysInactivos.map((gateway) => (
              <button
                type="button"
                key={gateway._id}
                className="btn btn-sm btn-outline-success"
                disabled={procesando === gateway._id}
                onClick={() => void ejecutar(gateway._id, () => reactivarGateway(gateway._id))}
              >
                Reactivar Gateway {gateway.numeroGateway}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="queue-panel">
        <div className="d-flex align-items-center justify-content-between gap-3 mb-3">
          <div>
            <h3 className="h5 mb-1">Cola de prioridad</h3>
            <p className="small text-secondary mb-0">Ordenada por puntualidad y tiempo de espera con aging.</p>
          </div>
          <span className="badge text-bg-secondary">{cola.length} en espera</span>
        </div>
        {cola.length === 0 ? (
          <p className="text-secondary mb-0">No hay pedidos esperando gateway.</p>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead><tr><th>Prioridad</th><th>Pedido</th><th>Tipo de carga</th><th>Clasificación</th><th>Espera</th></tr></thead>
              <tbody>
                {cola.map((pedido, index) => (
                  <tr key={pedido._id}>
                    <td><span className="badge text-bg-dark">{index + 1}</span></td>
                    <td className="fw-semibold">{pedido.numeroPedido}</td>
                    <td>{pedido.tipoProducto}</td>
                    <td>{pedido.estado}</td>
                    <td>{pedido.minutosEnCola === null ? '—' : `${pedido.minutosEnCola} min`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
