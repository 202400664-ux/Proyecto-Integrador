'use client';

import { useEffect, useState } from 'react';
import { encabezadosAutenticados } from '../api';

interface AuditoriaRow {
  _id: string;
  entidad: string;
  accion: string;
  detalle: string;
  usuario: string;
  fecha: string;
}

interface EventoRow {
  _id: string;
  accion: string;
  detalles: Record<string, unknown>;
  fechaHora: string;
  usuarioId: {
    nombres?: string;
    apellidosCompleto?: string;
    email?: string;
  } | null;
  pedidoId?: { numeroPedido: string } | null;
}

export default function AuditoriaPanel() {
  const [items, setItems] = useState<AuditoriaRow[]>([]);
  const [eventos, setEventos] = useState<EventoRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const cargar = async () => {
      try {
        const headers = encabezadosAutenticados();
        const [respuestaAuditoria, respuestaEventos] = await Promise.all([
          fetch('http://localhost:4000/api/auditoria', { headers }),
          fetch('http://localhost:4000/api/eventos', { headers }),
        ]);
        const [dataAuditoria, dataEventos] = await Promise.all([
          respuestaAuditoria.json(),
          respuestaEventos.json(),
        ]);
        if (!respuestaAuditoria.ok) throw new Error(dataAuditoria.mensaje || 'Error al consultar auditoría');
        if (!respuestaEventos.ok) throw new Error(dataEventos.mensaje || 'Error al consultar eventos inmutables');
        setItems(dataAuditoria.auditorias || []);
        setEventos(dataEventos.eventos || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo cargar la auditoría');
      } finally {
        setCargando(false);
      }
    };

    cargar();
  }, []);

  return (
    <div className="d-grid gap-4">
      <section className="card p-4 shadow-sm border-0">
        <h2 className="h5 fw-bold mb-3">Bitácora inmutable de eventos</h2>
        <p className="text-secondary">Registros insert-only con identidad del usuario autenticado. Se muestran los 200 más recientes.</p>
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        {cargando ? (
          <p className="text-secondary">Cargando eventos...</p>
        ) : eventos.length === 0 ? (
          <p className="text-secondary">Todavía no hay eventos registrados.</p>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Evento</th>
                  <th>Pedido</th>
                  <th>Usuario autenticado</th>
                  <th>Detalles</th>
                </tr>
              </thead>
              <tbody>
                {eventos.map((evento) => {
                  const usuario = evento.usuarioId;
                  const nombreUsuario = usuario
                    ? [usuario.nombres, usuario.apellidosCompleto].filter(Boolean).join(' ') || usuario.email || 'Usuario'
                    : 'Usuario no disponible';
                  return (
                    <tr key={evento._id}>
                      <td>{new Date(evento.fechaHora).toLocaleString('es-SV', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                      <td>{evento.accion.replaceAll('_', ' ')}</td>
                      <td>{evento.pedidoId?.numeroPedido ?? '—'}</td>
                      <td>{nombreUsuario}</td>
                      <td><code>{JSON.stringify(evento.detalles)}</code></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card p-4 shadow-sm border-0">
        <h2 className="h5 fw-bold mb-3">Historial operativo</h2>
      {cargando ? (
        <p className="text-secondary">Cargando historial...</p>
      ) : items.length === 0 ? (
        <p className="text-secondary">Todavía no hay registros de auditoría.</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm align-middle">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Entidad</th>
                <th>Acción</th>
                <th>Usuario</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item._id}>
                  <td>{new Date(item.fecha).toLocaleString('es-SV', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                  <td>{item.entidad}</td>
                  <td className="text-capitalize">{item.accion}</td>
                  <td>{item.usuario}</td>
                  <td>{item.detalle}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </section>
    </div>
  );
}
