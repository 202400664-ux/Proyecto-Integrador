'use client';

import { useEffect, useState } from 'react';
import { API_BASE_URL, ApiError } from '../api';
import { obtenerNombreUsuarioActual } from '../../auth';

interface Parametro {
  _id: string;
  clave: string;
  valor: string;
  descripcion: string;
}

export default function ParametrosPanel() {
  const [parametros, setParametros] = useState<Parametro[]>([]);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState<string | null>(null);
  const [valor, setValor] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [error, setError] = useState('');

  const cargar = async () => {
    const response = await fetch(`${API_BASE_URL}/parametros`);
    const data = await response.json();
    if (!response.ok) throw new ApiError(response.status, data, data.mensaje || 'No se pudieron cargar los parámetros');
    setParametros(data.parametros || []);
  };

  useEffect(() => {
    cargar().catch((err) => setError(err instanceof Error ? err.message : 'No se pudieron cargar los parámetros')).finally(() => setCargando(false));
  }, []);

  const guardar = async (id: string) => {
    const response = await fetch(`${API_BASE_URL}/parametros/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valor, descripcion, usuarioActualizacion: obtenerNombreUsuarioActual() }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.mensaje || 'No se pudo actualizar el parámetro');
    setParametros((prev) => prev.map((item) => item._id === id ? data.parametro : item));
    setEditando(null);
  };

  const inactivar = async (id: string) => {
    if (!window.confirm('¿Inactivar este parámetro? Se conservará en la base de datos.')) return;
    const response = await fetch(`${API_BASE_URL}/parametros/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuarioActualizacion: obtenerNombreUsuarioActual() }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.mensaje || 'No se pudo inactivar el parámetro');
    setParametros((prev) => prev.filter((item) => item._id !== id));
  };

  return (
    <div className="card p-4 shadow-sm border-0">
      <h2 className="h5 fw-bold mb-2" style={{ color: '#123149' }}>Parámetros del sistema</h2>
      <p className="text-secondary mb-4">Configuración administrativa de tolerancias, ausencias y horario operativo.</p>
      {error && <div className="alert alert-danger">{error}</div>}
      {cargando ? <p className="text-secondary">Cargando parámetros...</p> : parametros.length === 0 ? <p className="text-secondary">No hay parámetros activos.</p> : (
        <div className="table-responsive">
          <table className="table align-middle">
            <thead><tr><th>Clave</th><th>Valor</th><th>Descripción</th><th>Acciones</th></tr></thead>
            <tbody>
              {parametros.map((parametro) => (
                <tr key={parametro._id}>
                  <td className="fw-semibold">{parametro.clave}</td>
                  <td>{editando === parametro._id ? <input className="form-control" value={valor} onChange={(e) => setValor(e.target.value)} /> : parametro.valor}</td>
                  <td>{editando === parametro._id ? <input className="form-control" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} /> : parametro.descripcion}</td>
                  <td className="text-nowrap">
                    {editando === parametro._id ? (
                      <>
                        <button type="button" className="btn btn-sm btn-primary me-2" onClick={() => guardar(parametro._id)}>Guardar</button>
                        <button type="button" className="btn btn-sm btn-link" onClick={() => setEditando(null)}>Cancelar</button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="btn btn-sm btn-outline-primary me-2" onClick={() => { setEditando(parametro._id); setValor(parametro.valor); setDescripcion(parametro.descripcion); }}>Editar</button>
                        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => inactivar(parametro._id)}>Inactivar</button>
                      </>
                    )}
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