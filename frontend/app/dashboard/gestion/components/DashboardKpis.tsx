'use client';

import { useEffect, useState } from 'react';
import { obtenerDashboardKpis } from '../api';
import type { DashboardKpis as DashboardKpisData } from '../types';

const ESTADOS_CUMPLIMIENTO: Array<keyof DashboardKpisData['nivelCumplimiento']> = [
  'A TIEMPO',
  'ANTICIPADO',
  'TARDÍO',
  'AUSENTE',
];

export default function DashboardKpis() {
  const [datos, setDatos] = useState<DashboardKpisData | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let activo = true;
    const cargar = async () => {
      try {
        const resultado = await obtenerDashboardKpis();
        if (activo) {
          setDatos(resultado);
          setError('');
        }
      } catch (err) {
        if (activo) setError(err instanceof Error ? err.message : 'No se pudieron consultar los indicadores');
      } finally {
        if (activo) setCargando(false);
      }
    };

    void cargar();
    return () => {
      activo = false;
    };
  }, [intento]);

  if (cargando) return <div className="card p-4">Cargando indicadores logísticos...</div>;
  if (!datos) {
    return (
      <section className="kpi-dashboard">
        <div className="alert alert-danger" role="alert">{error || 'No hay indicadores disponibles.'}</div>
        <button type="button" className="btn btn-outline-primary" onClick={() => {
          setCargando(true);
          setIntento((actual) => actual + 1);
        }}>
          Reintentar
        </button>
      </section>
    );
  }

  const maxVolumen = Math.max(
    1,
    ...datos.volumenDiario.flatMap(({ atendidos, finalizados }) => [atendidos, finalizados])
  );

  return (
    <section className="kpi-dashboard" aria-labelledby="kpi-title">
      <header className="kpi-heading">
        <div>
          <p className="text-uppercase small fw-bold mb-1 text-warning">Analítica logística</p>
          <h2 id="kpi-title" className="h4 mb-1">Indicadores clave de desempeño</h2>
          <p className="text-secondary mb-0">Actualizado al consultar · Ocupación de los últimos {datos.periodoOcupacionDias} días</p>
        </div>
        <button type="button" className="btn btn-outline-primary" disabled={cargando} onClick={() => {
          setCargando(true);
          setIntento((actual) => actual + 1);
        }}>
          {cargando ? 'Actualizando...' : 'Actualizar indicadores'}
        </button>
      </header>

      {error && <div className="alert alert-warning py-2" role="status">{error}</div>}

      <div className="kpi-summary-grid">
        <article className="kpi-summary-card">
          <span>Espera promedio</span>
          <strong>{datos.tiempoPromedioEsperaMinutos.toFixed(2)} <small>min</small></strong>
          <p>Desde el arribo registrado hasta el inicio en muelle</p>
        </article>
        <article className="kpi-summary-card">
          <span>Descarga general</span>
          <strong>{datos.tiempoPromedioDescargaMinutos.general.toFixed(2)} <small>min</small></strong>
          <p>Duración promedio de mercancía general finalizada</p>
        </article>
        <article className="kpi-summary-card">
          <span>Descarga construcción</span>
          <strong>{datos.tiempoPromedioDescargaMinutos.construccion.toFixed(2)} <small>min</small></strong>
          <p>Duración promedio de mercancía de construcción finalizada</p>
        </article>
      </div>

      <div className="kpi-detail-grid">
        <article className="kpi-chart-card">
          <h3>Nivel de cumplimiento</h3>
          <p>Distribución porcentual de las citas activas, incluidos los pedidos ausentes.</p>
          <div className="kpi-compliance-list">
            {ESTADOS_CUMPLIMIENTO.map((estado) => {
              const item = datos.nivelCumplimiento[estado];
              return (
                <div className="kpi-compliance-row" key={estado}>
                  <div className="kpi-row-label">
                    <span>{estado}</span>
                    <strong>{item.porcentaje.toFixed(2)}% <small>({item.cantidad})</small></strong>
                  </div>
                  <div
                    className="kpi-track"
                    role="progressbar"
                    aria-label={`${estado}: ${item.porcentaje}%`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={item.porcentaje}
                  >
                    <span style={{ width: `${Math.min(100, item.porcentaje)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <article className="kpi-chart-card">
          <h3>Ocupación por muelle</h3>
          <p>Porcentaje del horario operativo utilizado en los últimos {datos.periodoOcupacionDias} días.</p>
          <div className="kpi-gateway-list">
            {datos.ocupacionPorGateway.map((gateway) => (
              <div className="kpi-compliance-row" key={gateway.numeroGateway}>
                <div className="kpi-row-label">
                  <span>Gateway {gateway.numeroGateway}</span>
                  <strong>{gateway.porcentaje.toFixed(2)}%</strong>
                </div>
                <div
                  className="kpi-track"
                  role="progressbar"
                  aria-label={`Ocupación Gateway ${gateway.numeroGateway}: ${gateway.porcentaje}%`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={gateway.porcentaje}
                >
                  <span style={{ width: `${Math.min(100, gateway.porcentaje)}%` }} />
                </div>
                <small>{gateway.minutosOcupados.toFixed(0)} de {gateway.minutosOperativos.toFixed(0)} min operativos</small>
              </div>
            ))}
          </div>
        </article>
      </div>

      <article className="kpi-chart-card kpi-volume-card">
        <div className="kpi-volume-heading">
          <div>
            <h3>Volumen diario de recepción</h3>
            <p>Pedidos atendidos por fecha de llegada y finalizados por fecha de cierre.</p>
          </div>
          <div className="kpi-chart-legend" aria-label="Leyenda">
            <span><i className="kpi-legend-arribos" /> Atendidos</span>
            <span><i className="kpi-legend-finalizados" /> Finalizados</span>
          </div>
        </div>
        {datos.volumenDiario.length === 0 ? (
          <p className="text-secondary mb-0">Todavía no hay actividad registrada.</p>
        ) : (
          <div className="kpi-volume-chart" role="img" aria-label="Comparación diaria de pedidos atendidos y finalizados">
            {datos.volumenDiario.map(({ fecha, atendidos, finalizados }) => (
              <div
                className="kpi-volume-day"
                key={fecha}
                aria-label={`${fecha}: ${atendidos} atendidos, ${finalizados} finalizados`}
              >
                <small className="kpi-volume-count">{atendidos}/{finalizados}</small>
                <div className="kpi-volume-bars">
                  <span
                    className="kpi-bar-arribos"
                    style={{ height: atendidos ? `${Math.max(3, (atendidos / maxVolumen) * 100)}%` : '0%' }}
                    title={`${atendidos} atendidos`}
                  />
                  <span
                    className="kpi-bar-finalizados"
                    style={{ height: finalizados ? `${Math.max(3, (finalizados / maxVolumen) * 100)}%` : '0%' }}
                    title={`${finalizados} finalizados`}
                  />
                </div>
                <span>{new Date(`${fecha}T12:00:00`).toLocaleDateString('es-SV', { day: '2-digit', month: 'short' })}</span>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
