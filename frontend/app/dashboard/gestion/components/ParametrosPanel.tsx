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

interface ParametrosPanelProps {
  puedeGestionar: boolean;
}

export default function ParametrosPanel({ puedeGestionar }: ParametrosPanelProps) {
  const [parametros, setParametros] = useState<Parametro[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [clave, setClave] = useState('');
  const [nuevoValor, setNuevoValor] = useState('');
  const [nuevaDescripcion, setNuevaDescripcion] = useState('');
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
    const cargarInicial = async () => {
      try {
        await cargar();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudieron cargar los parámetros');
      } finally {
        setCargando(false);
      }
    };

    void cargarInicial();
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

  const crear = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setGuardando(true);

    try {
      const response = await fetch(`${API_BASE_URL}/parametros`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clave,
          valor: nuevoValor,
          descripcion: nuevaDescripcion,
          usuarioCreacion: obtenerNombreUsuarioActual(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.mensaje || 'No se pudo crear el parámetro');

      setParametros((prev) => [...prev, data.parametro].sort((a, b) => a.clave.localeCompare(b.clave)));
      setClave('');
      setNuevoValor('');
      setNuevaDescripcion('');
      setMostrarFormulario(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el parámetro');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="card p-4 shadow-sm border-0">
      <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-start gap-3">
        <div>
          <h2 className="h5 fw-bold mb-2" style={{ color: '#123149' }}>Parámetros del sistema</h2>
          <p className="text-secondary mb-4">Configuración administrativa de tolerancias, ausencias y horario operativo.</p>
        </div>
        {puedeGestionar && (
          <button type="button" className="btn btn-primary flex-shrink-0" onClick={() => setMostrarFormulario((mostrar) => !mostrar)}>
            {mostrarFormulario ? 'Cancelar' : 'Nuevo parámetro'}
          </button>
        )}
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      {mostrarFormulario && puedeGestionar && (
        <form className="border rounded p-3 mb-4" onSubmit={crear}>
          <h3 className="h6 fw-bold mb-3">Registrar parámetro</h3>
          <div className="row g-3">
            <div className="col-md-4">
              <label htmlFor="parametro-clave" className="form-label">Clave</label>
              <input id="parametro-clave" className="form-control" value={clave} onChange={(event) => setClave(event.target.value)} required />
            </div>
            <div className="col-md-4">
              <label htmlFor="parametro-valor" className="form-label">Valor</label>
              <input id="parametro-valor" className="form-control" value={nuevoValor} onChange={(event) => setNuevoValor(event.target.value)} required />
            </div>
            <div className="col-md-4">
              <label htmlFor="parametro-descripcion" className="form-label">Descripción</label>
              <input id="parametro-descripcion" className="form-control" value={nuevaDescripcion} onChange={(event) => setNuevaDescripcion(event.target.value)} required />
            </div>
          </div>
          <button type="submit" className="btn btn-primary mt-3" disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar parámetro'}
          </button>
        </form>
      )}
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