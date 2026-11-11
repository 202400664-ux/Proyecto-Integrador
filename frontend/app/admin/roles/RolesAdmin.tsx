'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { MODULOS, type Modulo } from '../../dashboard/permisos';
import { actualizarRol, crearRol, desactivarRol, obtenerRoles } from '../../dashboard/gestion/api';
import type { RolCatalogo } from '../../dashboard/gestion/types';

interface FormularioRol {
  nombreRol: string;
  descripcion: string;
  permisos: Modulo[];
}

const FORMULARIO_VACIO: FormularioRol = { nombreRol: '', descripcion: '', permisos: [] };
const ROLES_BASE = ['administrador', 'coordinador', 'operador'];

const etiquetaModulo = (clave: string) => MODULOS.find((modulo) => modulo.clave === clave)?.etiqueta ?? clave;

export default function RolesAdmin() {
  const [roles, setRoles] = useState<RolCatalogo[]>([]);
  const [formulario, setFormulario] = useState<FormularioRol>(FORMULARIO_VACIO);
  const [rolEditar, setRolEditar] = useState<RolCatalogo | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [procesando, setProcesando] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [errorFormulario, setErrorFormulario] = useState('');
  const [mensaje, setMensaje] = useState('');

  const cargarRoles = useCallback(async () => {
    setRoles(await obtenerRoles());
  }, []);

  useEffect(() => {
    let activo = true;
    obtenerRoles()
      .then((lista) => {
        if (activo) setRoles(lista);
      })
      .catch((err: unknown) => {
        if (activo) setError(err instanceof Error ? err.message : 'No se pudieron cargar los roles');
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, []);

  const abrirCreacion = () => {
    setRolEditar(null);
    setFormulario(FORMULARIO_VACIO);
    setErrorFormulario('');
    setMensaje('');
    setModalAbierto(true);
  };

  const abrirEdicion = (rol: RolCatalogo) => {
    setRolEditar(rol);
    setFormulario({ nombreRol: rol.nombreRol, descripcion: rol.descripcion, permisos: rol.permisos });
    setErrorFormulario('');
    setMensaje('');
    setModalAbierto(true);
  };

  const alternarPermiso = (modulo: Modulo) => {
    setFormulario((actual) => ({
      ...actual,
      permisos: actual.permisos.includes(modulo)
        ? actual.permisos.filter((item) => item !== modulo)
        : [...actual.permisos, modulo],
    }));
  };

  const guardar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorFormulario('');
    if (formulario.permisos.length === 0) {
      setErrorFormulario('Seleccione al menos un módulo permitido.');
      return;
    }
    setGuardando(true);
    try {
      if (rolEditar) {
        await actualizarRol(rolEditar._id, formulario);
      } else {
        await crearRol(formulario);
      }
      await cargarRoles();
      setModalAbierto(false);
      setMensaje(rolEditar ? `Rol "${formulario.nombreRol}" actualizado.` : `Rol "${formulario.nombreRol}" creado.`);
    } catch (err) {
      setErrorFormulario(err instanceof Error ? err.message : 'No se pudo guardar el rol');
    } finally {
      setGuardando(false);
    }
  };

  const ejecutar = async (rol: RolCatalogo, accion: () => Promise<unknown>, exito: string) => {
    setError('');
    setMensaje('');
    setProcesando(rol._id);
    try {
      await accion();
      await cargarRoles();
      setMensaje(exito);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar la operación');
    } finally {
      setProcesando(null);
    }
  };

  const rolesVisibles = roles.filter((rol) => filtroEstado === 'todos' || (filtroEstado === 'activos' ? rol.activo : !rol.activo));
  const editandoBase = rolEditar !== null && ROLES_BASE.includes(rolEditar.nombreRol);
  const editandoAdministrador = rolEditar?.nombreRol === 'administrador';

  return (
    <section className="user-management">
      <header className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <h2 className="mb-1">Catálogo de roles</h2>
          <p className="text-secondary mb-0">Defina los perfiles de acceso y los módulos que cada uno puede usar.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={abrirCreacion}>+ Crear rol</button>
      </header>

      {error && <div className="alert alert-warning" role="alert">{error}</div>}
      {mensaje && <div className="alert alert-success" role="status">{mensaje}</div>}

      <div className="card shadow-sm">
        <div className="card-header bg-white d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div>
            <h3 className="h5 mb-1">Roles registrados</h3>
            <span className="text-secondary small">{cargando ? 'Cargando roles…' : `${rolesVisibles.length} de ${roles.length} roles`}</span>
          </div>
          <div>
            <label htmlFor="roleStatusFilter" className="visually-hidden">Filtrar por estado</label>
            <select id="roleStatusFilter" className="form-select form-select-sm" value={filtroEstado} onChange={(event) => setFiltroEstado(event.target.value)}>
              <option value="todos">Todos</option>
              <option value="activos">Activos</option>
              <option value="inactivos">Inactivos</option>
            </select>
          </div>
        </div>
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr><th>Rol</th><th>Descripción</th><th>Permisos</th><th>Estado</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr><td colSpan={5} className="text-center py-4">Cargando roles…</td></tr>
              ) : rolesVisibles.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-4">No hay roles que coincidan con el filtro.</td></tr>
              ) : rolesVisibles.map((rol) => (
                <tr key={rol._id}>
                  <td className="fw-semibold rol-nombre">{rol.nombreRol}</td>
                  <td>{rol.descripcion}</td>
                  <td>
                    <div className="d-flex flex-wrap gap-1">
                      {rol.permisos.map((permiso) => <span key={permiso} className="badge text-bg-light border">{etiquetaModulo(permiso)}</span>)}
                    </div>
                  </td>
                  <td><span className={`badge ${rol.activo ? 'text-bg-success' : 'text-bg-secondary'}`}>{rol.activo ? 'Activo' : 'Inactivo'}</span></td>
                  <td>
                    <div className="d-flex gap-2">
                      <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => abrirEdicion(rol)}>Editar</button>
                      {rol.activo ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          disabled={ROLES_BASE.includes(rol.nombreRol) || procesando !== null}
                          title={ROLES_BASE.includes(rol.nombreRol) ? 'Los roles base no se pueden desactivar' : 'Baja lógica del rol'}
                          onClick={() => {
                            if (window.confirm(`¿Desactivar el rol "${rol.nombreRol}"?`)) {
                              void ejecutar(rol, () => desactivarRol(rol._id), `Rol "${rol.nombreRol}" desactivado.`);
                            }
                          }}
                        >
                          Desactivar
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-success"
                          disabled={procesando !== null}
                          onClick={() => void ejecutar(rol, () => actualizarRol(rol._id, { activo: true }), `Rol "${rol.nombreRol}" reactivado.`)}
                        >
                          Reactivar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* En portal: el panel del dashboard limitaría la altura del modal. */}
      {modalAbierto && createPortal(
        <>
          <div className="modal-backdrop fade show" />
          <div className="modal d-block" role="dialog" aria-modal="true" aria-labelledby="role-form-title" tabIndex={-1}>
            <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
              <div className="modal-content">
                <div className="modal-header">
                  <h2 className="modal-title fs-5" id="role-form-title">{rolEditar ? 'Editar rol' : 'Crear rol'}</h2>
                  <button type="button" className="btn-close" aria-label="Cerrar" onClick={() => setModalAbierto(false)} disabled={guardando} />
                </div>
                <form className="d-flex flex-column overflow-hidden" onSubmit={guardar}>
                  <div className="modal-body">
                    {errorFormulario && <div className="alert alert-danger" role="alert">{errorFormulario}</div>}
                    <div className="mb-3">
                      <label htmlFor="roleName" className="form-label">Nombre del rol</label>
                      <input
                        id="roleName"
                        className="form-control"
                        placeholder="Ej. Supervisor de Turno"
                        minLength={3}
                        maxLength={50}
                        value={formulario.nombreRol}
                        disabled={editandoBase}
                        onChange={(event) => setFormulario({ ...formulario, nombreRol: event.target.value })}
                        required
                      />
                    </div>
                    <div className="mb-3">
                      <label htmlFor="roleDescription" className="form-label">Descripción funcional</label>
                      <textarea
                        id="roleDescription"
                        className="form-control"
                        rows={2}
                        value={formulario.descripcion}
                        onChange={(event) => setFormulario({ ...formulario, descripcion: event.target.value })}
                        required
                      />
                    </div>
                    <fieldset>
                      <legend className="form-label fs-6">Módulos permitidos</legend>
                      <div className="row g-2">
                        {MODULOS.map((modulo) => (
                          <div className="col-md-6" key={modulo.clave}>
                            <div className="form-check">
                              <input
                                id={`modulo-${modulo.clave}`}
                                className="form-check-input"
                                type="checkbox"
                                checked={formulario.permisos.includes(modulo.clave)}
                                disabled={editandoAdministrador}
                                onChange={() => alternarPermiso(modulo.clave)}
                              />
                              <label className="form-check-label" htmlFor={`modulo-${modulo.clave}`}>
                                <span className="fw-semibold">{modulo.etiqueta}</span>
                                <span className="d-block small text-secondary">{modulo.ayuda}</span>
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </fieldset>
                  </div>
                  <div className="modal-footer">
                    <button className="btn btn-outline-secondary" type="button" onClick={() => setModalAbierto(false)} disabled={guardando}>Cancelar</button>
                    <button className="btn btn-primary" type="submit" disabled={guardando}>
                      {guardando ? 'Guardando…' : rolEditar ? 'Guardar cambios' : 'Crear rol'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </section>
  );
}
