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

export default function AuditoriaPanel() {
  const [items, setItems] = useState<AuditoriaRow[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const cargar = async () => {
      try {
        const response = await fetch('http://localhost:4000/api/auditoria', {
          headers: encabezadosAutenticados(),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.mensaje || 'Error al consultar auditoría');
        setItems(data.auditorias || []);
      } catch (error) {
        console.error(error);
      } finally {
        setCargando(false);
      }
    };

    cargar();
  }, []);

  return (
    <div className="card p-4 shadow-sm border-0">
      <h2 className="h5 fw-bold mb-3">Historial de auditoría</h2>
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
    </div>
  );
}
