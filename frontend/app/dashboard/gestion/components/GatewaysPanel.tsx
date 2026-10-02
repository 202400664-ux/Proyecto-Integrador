'use client';

import { useEffect, useState } from 'react';
import {
  actualizarGateway,
  crearGateway,
  finalizarDescarga,
  inactivarGateway,
  iniciarDescarga,
  obtenerDescargasActivas,
  obtenerGateways,
  obtenerPedidos,
} from '../api';
import type { Descarga, EstadoGateway, Gateway, Pedido } from '../types';

const ESTADOS_ELEGIBLES = ['EN COLA', 'ANTICIPADO', 'A TIEMPO', 'TARDÍO'];

function pedidoDe(descarga: Descarga | undefined): Pedido | null {
  return descarga && typeof descarga.pedidoId === 'object' ? descarga.pedidoId : null;
}

export default function GatewaysPanel({ puedeAdministrar }: { puedeAdministrar: boolean }) {
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [descargas, setDescargas] = useState<Descarga[]>([]);
  const [pedidoPorGateway, setPedidoPorGateway] = useState<Record<string, string>>({});
  const [numeroNuevo, setNumeroNuevo] = useState('');
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState('');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    let activo = true;
    const cargar = async () => {
      try {
        const [listaGateways, listaPedidos, listaDescargas] = await Promise.all([
          obtenerGateways(), obtenerPedidos(), obtenerDescargasActivas(),
        ]);
        if (!activo) return;
        setGateways(listaGateways);
        setPedidos(listaPedidos);
        setDescargas(listaDescargas);
        setError('');
      } catch (cause) {
        if (activo) setError(cause instanceof Error ? cause.message : 'No se pudo actualizar el tablero');
      } finally {
        if (activo) setCargando(false);
      }
    };

    void cargar();
    const intervalo = window.setInterval(() => void cargar(), 5000);
    return () => {
      activo = false;
      window.clearInterval(intervalo);
    };
  }, []);

  const ejecutar = async (clave: string, accion: () => Promise<void>, texto: string) => {
    setOcupado(clave);
    setError('');
    setMensaje('');
    try {
      await accion();
      setMensaje(texto);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo completar la operación');
    } finally {
      setOcupado('');
    }
  };

  const recargar = async () => {
    const [listaGateways, listaPedidos, listaDescargas] = await Promise.all([
      obtenerGateways(), obtenerPedidos(), obtenerDescargasActivas(),
    ]);
    setGateways(listaGateways);
    setPedidos(listaPedidos);
    setDescargas(listaDescargas);
  };

  const agregarGateway = async () => {
    const numeroGateway = Number(numeroNuevo);
    const tipoCargaPermitida = numeroGateway === 5 ? 'construcción' : 'general';
    await ejecutar('nuevo', async () => {
      await crearGateway({ numeroGateway, tipoCargaPermitida });
      await recargar();
      setNumeroNuevo('');
    }, `Gateway ${numeroGateway} creado.`);
  };

  const numerosDisponibles = [1, 2, 3, 4, 5].filter(
    (numero) => !gateways.some((gateway) => gateway.numeroGateway === numero)
  );

  return (
    <section className="gateway-monitor" aria-labelledby="gateway-monitor-title">
      <header className="gateway-monitor-header">
        <div>
          <p className="gateway-monitor-kicker">Operaciones de descarga</p>
          <h2 id="gateway-monitor-title">Monitoreo de gateways</h2>
        </div>
        <span className="gateway-refresh-state" aria-live="polite">Actualización cada 5 s</span>
      </header>

      {error && <div className="alert alert-danger py-2" role="alert">{error}</div>}
      {mensaje && <div className="alert alert-success py-2" role="status">{mensaje}</div>}

      {puedeAdministrar && numerosDisponibles.length > 0 && (
        <div className="gateway-admin-tools">
          <label htmlFor="gateway-nuevo" className="form-label mb-0">Agregar infraestructura</label>
          <select id="gateway-nuevo" className="form-select" value={numeroNuevo} onChange={(event) => setNumeroNuevo(event.target.value)}>
            <option value="">Gateway</option>
            {numerosDisponibles.map((numero) => <option key={numero} value={numero}>{numero}</option>)}
          </select>
          {numeroNuevo && <span className="small text-secondary">Carga {Number(numeroNuevo) === 5 ? 'construcción' : 'general'}</span>}
          <button type="button" className="btn btn-primary btn-sm" disabled={!numeroNuevo || ocupado === 'nuevo'} onClick={() => void agregarGateway()}>
            {ocupado === 'nuevo' ? 'Guardando...' : 'Crear gateway'}
          </button>
        </div>
      )}

      {cargando ? <p className="text-secondary">Cargando gateways...</p> : gateways.length === 0 ? (
        <p className="text-secondary">No hay gateways activos. El administrador puede crear los gateways disponibles.</p>
      ) : (
        <div className="gateway-grid">
          {gateways.map((gateway) => {
            const descarga = descargas.find((item) => item.gatewayId === gateway._id);
            const pedidoActivo = pedidoDe(descarga);
            const pedidosElegibles = pedidos.filter((pedido) =>
              ESTADOS_ELEGIBLES.includes(pedido.estado) && pedido.tipoProducto === gateway.tipoCargaPermitida
            );
            const claseEstado = gateway.estado === 'LIBRE' ? 'libre' : gateway.estado === 'OCUPADO' ? 'ocupado' : 'fuera-servicio';
            return (
              <article className={`gateway-unit ${claseEstado}`} key={gateway._id}>
                <div className="gateway-unit-heading">
                  <div>
                    <span className="gateway-number-label">Gateway</span>
                    <h3>{gateway.numeroGateway}</h3>
                  </div>
                  <span className="gateway-state-badge">{gateway.estado}</span>
                </div>
                <p className="gateway-cargo">Carga {gateway.tipoCargaPermitida}</p>

                {gateway.estado === 'OCUPADO' ? (
                  <div className="gateway-active-order">
                    <span>Pedido en descarga</span>
                    <strong>{pedidoActivo?.numeroPedido ?? 'Sin datos de pedido'}</strong>
                    {descarga && (
                      <button
                        type="button"
                        className="btn btn-dark btn-sm mt-3"
                        disabled={ocupado === descarga._id}
                        onClick={() => void ejecutar(descarga._id, async () => {
                          await finalizarDescarga(descarga._id);
                          await recargar();
                        }, `Descarga finalizada. Gateway ${gateway.numeroGateway} liberado.`)}
                      >
                        {ocupado === descarga._id ? 'Finalizando...' : 'Finalizar descarga'}
                      </button>
                    )}
                  </div>
                ) : gateway.estado === 'LIBRE' ? (
                  <div className="gateway-operation">
                    <label className="form-label" htmlFor={`pedido-${gateway._id}`}>Pedido elegible</label>
                    <select
                      id={`pedido-${gateway._id}`}
                      className="form-select form-select-sm"
                      value={pedidoPorGateway[gateway._id] ?? ''}
                      onChange={(event) => setPedidoPorGateway((actual) => ({ ...actual, [gateway._id]: event.target.value }))}
                    >
                      <option value="">Seleccionar pedido</option>
                      {pedidosElegibles.map((pedido) => <option key={pedido._id} value={pedido._id}>{pedido.numeroPedido}</option>)}
                    </select>
                    <button
                      type="button"
                      className="btn btn-success btn-sm mt-2"
                      disabled={!pedidoPorGateway[gateway._id] || ocupado === gateway._id}
                      onClick={() => void ejecutar(gateway._id, async () => {
                        await iniciarDescarga(pedidoPorGateway[gateway._id], gateway._id);
                        await recargar();
                      }, `Descarga iniciada en Gateway ${gateway.numeroGateway}.`)}
                    >
                      {ocupado === gateway._id ? 'Iniciando...' : 'Iniciar descarga'}
                    </button>
                  </div>
                ) : (
                  <p className="gateway-maintenance-note">Fuera de servicio</p>
                )}

                {puedeAdministrar && gateway.estado !== 'OCUPADO' && (
                  <div className="gateway-admin-actions">
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      disabled={ocupado === `estado-${gateway._id}`}
                      onClick={() => {
                        const estado: EstadoGateway = gateway.estado === 'LIBRE' ? 'FUERA DE SERVICIO' : 'LIBRE';
                        void ejecutar(`estado-${gateway._id}`, async () => {
                          await actualizarGateway(gateway._id, { estado });
                          await recargar();
                        }, `Gateway ${gateway.numeroGateway}: ${estado}.`);
                      }}
                    >
                      {gateway.estado === 'LIBRE' ? 'Enviar a mantenimiento' : 'Marcar libre'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-link btn-sm text-danger"
                      onClick={() => {
                        if (!window.confirm(`¿Inactivar el Gateway ${gateway.numeroGateway}?`)) return;
                        void ejecutar(`eliminar-${gateway._id}`, async () => {
                          await inactivarGateway(gateway._id);
                          await recargar();
                        }, `Gateway ${gateway.numeroGateway} inactivado.`);
                      }}
                    >
                      Inactivar
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}