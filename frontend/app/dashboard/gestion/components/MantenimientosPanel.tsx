'use client';

import { useEffect, useState } from 'react';
import type { Proveedor } from '../types';

interface Mantenimiento {
  _id: string;
  numeroOrden: string;
  proveedorId?: string | Proveedor | null;
  titulo: string;
  descripcion: string;
  tipo: 'preventivo' | 'correctivo' | 'predictivo';
  estado: 'pendiente' | 'en_progreso' | 'completado' | 'cancelado';
  responsable: string;
  fechaProgramada: string;
  observaciones?: string;
}

const getEstadoClass = (estado: string) => {
  switch (estado) {
    case 'completado':
      return 'bg-success';
    case 'en_progreso':
      return 'bg-warning text-dark';
    case 'cancelado':
      return 'bg-danger';
    default:
      return 'bg-secondary';
  }
};

export default function MantenimientosPanel() {
  const [mantenimientos, setMantenimientos] = useState<Mantenimiento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState('');

  const cargarMantenimientos = async () => {
    try {
      const response = await fetch('http://localhost:4000/api/mantenimientos');
      const data = await response.json();
      if (!response.ok) throw new Error(data.mensaje || 'No se pudieron cargar los mantenimientos');
      setMantenimientos(data.mantenimientos || []);
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : 'Error cargando mantenimientos');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    const cargarInicial = async () => {
      await cargarMantenimientos();
    };

    void cargarInicial();
  }, []);

  return (
    <div className="card p-4 shadow-sm border-0">
      <h2 className="h5 fw-bold mb-3">Mantenimientos programados</h2>
      {mensaje && <div className="alert alert-danger py-2" role="alert">{mensaje}</div>}
      {cargando ? (
        <p className="text-secondary">Cargando...</p>
      ) : mantenimientos.length === 0 ? (
        <p className="text-secondary">No hay mantenimientos registrados.</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm align-middle">
            <thead>
              <tr>
                <th>Orden</th>
                <th>Proveedor</th>
                <th>Título</th>
                <th>Tipo</th>
                <th>Responsable</th>
                <th>Fecha</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {mantenimientos.map((item) => (
                <tr key={item._id}>
                  <td>{item.numeroOrden}</td>
                  <td>
                    {typeof item.proveedorId === 'object' && item.proveedorId
                      ? `${item.proveedorId.razonSocial} (${item.proveedorId.identificacionTributaria})`
                      : 'Sin proveedor'}
                  </td>
                  <td>{item.titulo}</td>
                  <td className="text-capitalize">{item.tipo}</td>
                  <td>{item.responsable}</td>
                  <td>{new Date(item.fechaProgramada).toLocaleString('es-SV', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                  <td><span className={`badge ${getEstadoClass(item.estado)}`}>{item.estado}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
