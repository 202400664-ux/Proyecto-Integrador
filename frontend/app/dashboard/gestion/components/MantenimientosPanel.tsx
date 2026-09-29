'use client';

import { useEffect, useState } from 'react';
import { useRol } from '../../RolContext';
import { encabezadosAutenticados } from '../api';
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
  const { puede } = useRol();
  const [mantenimientos, setMantenimientos] = useState<Mantenimiento[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [cargandoProveedores, setCargandoProveedores] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState({
    numeroOrden: '',
    proveedorId: '',
    titulo: '',
    descripcion: '',
    tipo: 'preventivo',
    responsable: '',
    fechaProgramada: '',
    observaciones: '',
  });
  const [mensaje, setMensaje] = useState('');
  const [tipoMensaje, setTipoMensaje] = useState<'success' | 'danger'>('danger');

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

  const cargarProveedores = async () => {
    try {
      const response = await fetch('http://localhost:4000/api/proveedores');
      const data = await response.json();
      if (!response.ok) throw new Error(data.mensaje || 'No se pudieron cargar los proveedores');
      setProveedores(data.proveedores || []);
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : 'Error cargando proveedores');
    } finally {
      setCargandoProveedores(false);
    }
  };

  useEffect(() => {
    const cargarInicial = async () => {
      await Promise.all([cargarMantenimientos(), cargarProveedores()]);
    };

    void cargarInicial();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensaje('');
    setGuardando(true);

    try {
      const response = await fetch('http://localhost:4000/api/mantenimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...encabezadosAutenticados() },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.mensaje || 'Error al registrar mantenimiento');
      setForm({
        numeroOrden: '',
        proveedorId: '',
        titulo: '',
        descripcion: '',
        tipo: 'preventivo',
        responsable: '',
        fechaProgramada: '',
        observaciones: '',
      });
      await cargarMantenimientos();
      setMensaje('Mantenimiento registrado correctamente');
      setTipoMensaje('success');
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : 'Error al registrar mantenimiento');
      setTipoMensaje('danger');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="row g-4">
      <div className="col-lg-5">
        {puede('mantenimientos.crear') && (
          <form onSubmit={handleSubmit} className="card p-4 shadow-sm border-0 mb-4">
            <h2 className="h5 fw-bold mb-3">Registrar mantenimiento</h2>
            <div className="row g-3">
              <div className="col-md-6">
                <label htmlFor="mantenimiento-numero" className="form-label">Número</label>
                <input id="mantenimiento-numero" className="form-control" value={form.numeroOrden} onChange={(e) => setForm({ ...form, numeroOrden: e.target.value })} required />
              </div>
              <div className="col-md-6">
                <label htmlFor="mantenimiento-proveedor" className="form-label">Proveedor</label>
                <select
                  id="mantenimiento-proveedor"
                  className="form-select"
                  value={form.proveedorId}
                  onChange={(e) => setForm({ ...form, proveedorId: e.target.value })}
                  required
                  disabled={cargandoProveedores || proveedores.length === 0}
                >
                  <option value="" disabled>
                    {cargandoProveedores ? 'Cargando proveedores...' : proveedores.length === 0 ? 'No hay proveedores activos' : 'Seleccione un proveedor'}
                  </option>
                  {proveedores.map((proveedor) => (
                    <option key={proveedor._id} value={proveedor._id}>
                      {proveedor.razonSocial} ({proveedor.identificacionTributaria})
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label htmlFor="mantenimiento-tipo" className="form-label">Tipo</label>
                <select id="mantenimiento-tipo" className="form-select" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as typeof form.tipo })}>
                  <option value="preventivo">Preventivo</option>
                  <option value="correctivo">Correctivo</option>
                  <option value="predictivo">Predictivo</option>
                </select>
              </div>
              <div className="col-12">
                <label htmlFor="mantenimiento-titulo" className="form-label">Título</label>
                <input id="mantenimiento-titulo" className="form-control" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required />
              </div>
              <div className="col-12">
                <label htmlFor="mantenimiento-descripcion" className="form-label">Descripción</label>
                <textarea id="mantenimiento-descripcion" className="form-control" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} required />
              </div>
              <div className="col-md-6">
                <label htmlFor="mantenimiento-responsable" className="form-label">Responsable</label>
                <input id="mantenimiento-responsable" className="form-control" value={form.responsable} onChange={(e) => setForm({ ...form, responsable: e.target.value })} required />
              </div>
              <div className="col-md-6">
                <label htmlFor="mantenimiento-fecha" className="form-label">Fecha programada</label>
                <input id="mantenimiento-fecha" type="datetime-local" className="form-control" value={form.fechaProgramada} onChange={(e) => setForm({ ...form, fechaProgramada: e.target.value })} required />
              </div>
              <div className="col-12">
                <label htmlFor="mantenimiento-observaciones" className="form-label">Observaciones</label>
                <textarea id="mantenimiento-observaciones" className="form-control" value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
              </div>
            </div>
            <button className="btn btn-primary mt-3" type="submit" disabled={guardando || cargandoProveedores || proveedores.length === 0}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </form>
        )}
      </div>

      <div className="col-lg-7">
        <div className="card p-4 shadow-sm border-0">
          <h2 className="h5 fw-bold mb-3">Mantenimientos programados</h2>
          {mensaje && <div className={`alert alert-${tipoMensaje} py-2`} role={tipoMensaje === 'danger' ? 'alert' : 'status'}>{mensaje}</div>}
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
      </div>
    </div>
  );
}
