'use client';

import { useCallback, useEffect, useState } from 'react';
import { obtenerColaPrioridad, reevaluarColaPrioridad } from '../dashboard/gestion/api';
import type { Pedido } from '../dashboard/gestion/types';

const INTERVALO_REFRESCO_MS = 5000;

const CLASE_PUNTUALIDAD: Record<NonNullable<Pedido['clasificacionPuntualidad']>, string> = {
  'A TIEMPO': 'text-bg-success',
  ANTICIPADO: 'text-bg-warning',
  'TARDÍO': 'text-bg-danger',
};

const nombreProveedor = (pedido: Pedido) =>
  typeof pedido.proveedorId === 'object' && pedido.proveedorId ? pedido.proveedorId.razonSocial : 'Proveedor no disponible';

export default function ColaTablero() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [reevaluando, setReevaluando] = useState(false);
  const [actualizado, setActualizado] = useState<Date | null>(null);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      setPedidos(await obtenerColaPrioridad());
      setActualizado(new Date());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la cola de espera');
    } finally {
      setCargando(false);
    }
  }, []);

  // El refresco periódico refleja la salida del pedido promovido cuando otro
  // puesto libera un gateway, sin que el operador tenga que recargar.
  useEffect(() => {
    const inicial = window.setTimeout(() => void cargar(), 0);
    const intervalo = window.setInterval(() => void cargar(), INTERVALO_REFRESCO_MS);
    return () => {
      window.clearTimeout(inicial);
      window.clearInterval(intervalo);
    };
  }, [cargar]);

  const reevaluar = async () => {
    setReevaluando(true);
    setError('');
    try {
      await reevaluarColaPrioridad();
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo reevaluar la cola');
    } finally {
      setReevaluando(false);
    }
  };

  if (cargando) return <div className="card p-4">Cargando cola de espera…</div>;

  return (
    <section className="gateways-workspace">
      <header className="gateways-heading">
        <div>
          <p className="text-uppercase small fw-bold mb-1 text-warning">Motor de prioridad</p>
          <h2 className="h4 mb-1">Cola de espera</h2>
          <p className="text-secondary mb-0">
            Orden por prioridad calculada: puntualidad, hora programada y tiempo en espera.
            {actualizado && ` Actualizado ${actualizado.toLocaleTimeString('es-SV')}`}
          </p>
        </div>
        <div className="d-flex align-items-center gap-2">
          <span className="badge text-bg-secondary">{pedidos.length} en espera</span>
          <button type="button" className="btn btn-outline-primary" disabled={reevaluando} onClick={() => void reevaluar()}>
            {reevaluando ? 'Reevaluando…' : 'Reevaluar cola'}
          </button>
        </div>
      </header>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      {pedidos.length === 0 ? (
        <div className="queue-panel"><p className="text-secondary mb-0">No hay pedidos esperando gateway.</p></div>
      ) : (
        <ol className="cola-grid">
          {pedidos.map((pedido, indice) => (
            <li className={`cola-card ${indice === 0 ? 'cola-card-siguiente' : ''}`} key={pedido._id}>
              <div className="cola-card-head">
                <span className="cola-posicion" aria-label={`Posición ${indice + 1}`}>{indice + 1}</span>
                <div className="cola-card-titulo">
                  <strong>{pedido.numeroPedido}</strong>
                  <span>{nombreProveedor(pedido)}</span>
                </div>
                <div className="cola-prioridad">
                  <small>Prioridad</small>
                  <strong>{pedido.prioridadCalculada ?? '—'}</strong>
                </div>
              </div>
              <div className="d-flex flex-wrap gap-2">
                {pedido.clasificacionPuntualidad && (
                  <span className={`badge ${CLASE_PUNTUALIDAD[pedido.clasificacionPuntualidad]}`}>{pedido.clasificacionPuntualidad}</span>
                )}
                <span className={`badge ${pedido.tipoProducto === 'construcción' ? 'text-bg-dark' : 'text-bg-info'}`}>{pedido.tipoProducto}</span>
                {pedido.excedeLimiteEspera && <span className="badge text-bg-danger">Espera crítica</span>}
              </div>
              <dl className="cola-datos">
                <div><dt>En espera</dt><dd>{pedido.minutosEnEspera ?? 0} min</dd></div>
                <div>
                  <dt>Programado</dt>
                  <dd>{new Date(pedido.fechaHoraProgramada).toLocaleString('es-SV', { dateStyle: 'short', timeStyle: 'short' })}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
