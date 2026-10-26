'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';

const API_URL = 'http://localhost:4000';
const ROLES = ['administrador', 'coordinador', 'operador'] as const;
const USUARIOS_POR_PAGINA = 10;

interface Usuario {
  id: string;
  nombres: string;
  apellidosCompleto: string;
  email: string;
  rol: typeof ROLES[number];
  activo: boolean;
  mfaObligatorio: boolean;
  twoFactorEnabled: boolean;
}

interface FormularioUsuario {
  nombres: string;
  apellidosCompleto: string;
  email: string;
  password: string;
  rol: typeof ROLES[number];
  mfaObligatorio: boolean;
  activo: boolean;
}

const FORMULARIO_VACIO: FormularioUsuario = {
  nombres: '',
  apellidosCompleto: '',
  email: '',
  password: '',
  rol: 'operador',
  mfaObligatorio: false,
  activo: true,
};

export default function UserForm() {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [formulario, setFormulario] = useState<FormularioUsuario>(FORMULARIO_VACIO);
  const [usuarioEditar, setUsuarioEditar] = useState<string | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroMfa, setFiltroMfa] = useState('todos');
  const [paginaActual, setPaginaActual] = useState(1);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [restableciendoMfa, setRestableciendoMfa] = useState<string | null>(null);

  const obtenerToken = useCallback(() => localStorage.getItem('token') ?? '', []);

  const cargarUsuarios = useCallback(async () => {
    const response = await fetch(`${API_URL}/api/usuarios`, {
      headers: { Authorization: `Bearer ${obtenerToken()}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.mensaje || 'No se pudieron cargar los usuarios');
    setUsuarios(data as Usuario[]);
  }, [obtenerToken]);

  useEffect(() => {
    const token = obtenerToken();
    if (!token) {
      router.replace('/');
      return;
    }
    try {
      const payload = jwtDecode<{ rol?: string; exp?: number }>(token);
      if (payload.rol !== 'administrador' || !payload.exp || payload.exp * 1000 <= Date.now()) {
        router.replace('/dashboard');
        return;
      }
    } catch {
      router.replace('/');
      return;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      void cargarUsuarios()
        .catch((loadError: unknown) => {
          if (active) setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los usuarios');
        })
        .finally(() => {
          if (active) setCargando(false);
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [cargarUsuarios, obtenerToken, router]);

  const cancelarEdicion = () => {
    setModalAbierto(false);
    setUsuarioEditar(null);
    setFormulario(FORMULARIO_VACIO);
    setError('');
  };

  const crearUsuario = () => {
    setUsuarioEditar(null);
    setFormulario(FORMULARIO_VACIO);
    setError('');
    setMensaje('');
    setModalAbierto(true);
  };

  const editarUsuario = (usuario: Usuario) => {
    setUsuarioEditar(usuario.id);
    setFormulario({
      nombres: usuario.nombres,
      apellidosCompleto: usuario.apellidosCompleto,
      email: usuario.email,
      password: '',
      rol: usuario.rol,
      mfaObligatorio: usuario.mfaObligatorio,
      activo: usuario.activo,
    });
    setError('');
    setMensaje('');
    setModalAbierto(true);
  };

  const guardarUsuario = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMensaje('');
    setGuardando(true);
    const creando = usuarioEditar === null;
    const payload: Record<string, string | boolean> = { ...formulario };
    if (!creando && !formulario.password) delete payload.password;

    try {
      const response = await fetch(
        `${API_URL}/api/usuarios${creando ? '' : `/${usuarioEditar}`}`,
        {
          method: creando ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${obtenerToken()}` },
          body: JSON.stringify(payload),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.mensaje || 'No se pudo guardar el usuario');
      await cargarUsuarios();
      cancelarEdicion();
      setMensaje(creando ? 'Usuario creado correctamente.' : 'Usuario actualizado correctamente.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el usuario');
    } finally {
      setGuardando(false);
    }
  };

  const restablecerMfaUsuario = async (usuario: Usuario) => {
    const confirmado = window.confirm(
      `¿Restablecer el MFA de ${usuario.nombres} ${usuario.apellidosCompleto}? Se eliminará su autenticador actual.${usuario.mfaObligatorio ? ' Tendrá que enrolarse de nuevo en su próximo inicio de sesión.' : ' Podrá iniciar sesión sin código mientras MFA no sea obligatorio.'}`
    );
    if (!confirmado) return;

    setError('');
    setMensaje('');
    setRestableciendoMfa(usuario.id);
    try {
      const response = await fetch(`${API_URL}/api/usuarios/${usuario.id}/mfa/reset`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${obtenerToken()}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.mensaje || 'No se pudo restablecer MFA');
      await cargarUsuarios();
      setMensaje(data.mensaje || 'MFA restablecido correctamente.');
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'No se pudo restablecer MFA');
    } finally {
      setRestableciendoMfa(null);
    }
  };

  const usuariosFiltrados = usuarios.filter((usuario) => {
    const termino = busqueda.trim().toLocaleLowerCase();
    const coincideBusqueda = !termino
      || `${usuario.nombres} ${usuario.apellidosCompleto} ${usuario.email}`.toLocaleLowerCase().includes(termino);
    const coincideRol = filtroRol === 'todos' || usuario.rol === filtroRol;
    const coincideEstado = filtroEstado === 'todos'
      || (filtroEstado === 'activos' ? usuario.activo : !usuario.activo);
    const coincideMfa = filtroMfa === 'todos'
      || (filtroMfa === 'requerido' ? usuario.mfaObligatorio : !usuario.mfaObligatorio);
    return coincideBusqueda && coincideRol && coincideEstado && coincideMfa;
  });
  const totalPaginas = Math.ceil(usuariosFiltrados.length / USUARIOS_POR_PAGINA);
  const paginaVisible = Math.min(paginaActual, Math.max(1, totalPaginas));
  const usuariosVisibles = usuariosFiltrados.slice(
    (paginaVisible - 1) * USUARIOS_POR_PAGINA,
    paginaVisible * USUARIOS_POR_PAGINA
  );

  return (
    <section className="user-management">
      <header className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <h2 className="mb-1">Administración de usuarios</h2>
          <p className="text-secondary mb-0">Busque, filtre y administre los perfiles y su configuración de acceso.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={crearUsuario}>
          + Crear usuario
        </button>
      </header>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {mensaje && <div className="alert alert-success" role="status">{mensaje}</div>}

      <div className="card shadow-sm">
        <div className="card-header bg-white d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div>
            <h3 className="h5 mb-1">Usuarios registrados</h3>
            <span className="text-secondary small">
              {cargando ? 'Cargando usuarios…' : `${usuariosFiltrados.length} de ${usuarios.length} usuarios`}
            </span>
          </div>
        </div>
        <div className="card-body border-bottom">
          <div className="row g-3">
            <div className="col-lg-4">
              <label htmlFor="userSearch" className="form-label">Buscar usuario</label>
              <input
                id="userSearch"
                className="form-control"
                type="search"
                placeholder="Nombre, apellidos o correo"
                value={busqueda}
                onChange={(event) => {
                  setBusqueda(event.target.value);
                  setPaginaActual(1);
                }}
              />
            </div>
            <div className="col-sm-4 col-lg-2">
              <label htmlFor="userRoleFilter" className="form-label">Rol</label>
              <select id="userRoleFilter" className="form-select" value={filtroRol} onChange={(event) => {
                setFiltroRol(event.target.value);
                setPaginaActual(1);
              }}>
                <option value="todos">Todos</option>
                {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
            </div>
            <div className="col-sm-4 col-lg-2">
              <label htmlFor="userStatusFilter" className="form-label">Estado</label>
              <select id="userStatusFilter" className="form-select" value={filtroEstado} onChange={(event) => {
                setFiltroEstado(event.target.value);
                setPaginaActual(1);
              }}>
                <option value="todos">Todos</option>
                <option value="activos">Activos</option>
                <option value="inactivos">Inactivos</option>
              </select>
            </div>
            <div className="col-sm-4 col-lg-2">
              <label htmlFor="userMfaFilter" className="form-label">MFA requerido</label>
              <select id="userMfaFilter" className="form-select" value={filtroMfa} onChange={(event) => {
                setFiltroMfa(event.target.value);
                setPaginaActual(1);
              }}>
                <option value="todos">Todos</option>
                <option value="requerido">Requerido</option>
                <option value="no-requerido">No requerido</option>
              </select>
            </div>
            <div className="col-lg-2 d-flex align-items-end">
              <button
                type="button"
                className="btn btn-outline-secondary w-100"
                onClick={() => {
                  setBusqueda('');
                  setFiltroRol('todos');
                  setFiltroEstado('todos');
                  setFiltroMfa('todos');
                  setPaginaActual(1);
                }}
                disabled={!busqueda && filtroRol === 'todos' && filtroEstado === 'todos' && filtroMfa === 'todos'}
              >
                Limpiar filtros
              </button>
            </div>
          </div>
        </div>
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr><th>Usuario</th><th>Correo</th><th>Rol</th><th>Estado</th><th>MFA requerido</th><th>Enrolado</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr><td colSpan={7} className="text-center py-4">Cargando usuarios…</td></tr>
              ) : usuarios.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-4">No hay usuarios registrados.</td></tr>
              ) : usuariosFiltrados.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-4">No hay usuarios que coincidan con la búsqueda o los filtros.</td></tr>
              ) : usuariosVisibles.map((usuario) => (
                <tr key={usuario.id}>
                  <td>{usuario.nombres} {usuario.apellidosCompleto}</td>
                  <td>{usuario.email}</td>
                  <td className="text-capitalize">{usuario.rol}</td>
                  <td><span className={`badge ${usuario.activo ? 'text-bg-success' : 'text-bg-secondary'}`}>{usuario.activo ? 'Activo' : 'Inactivo'}</span></td>
                  <td>{usuario.mfaObligatorio ? 'Sí' : 'No'}</td>
                  <td>{usuario.twoFactorEnabled ? 'Sí' : 'No'}</td>
                  <td>
                    <div className="d-flex gap-2">
                      <button className="btn btn-sm btn-outline-primary" type="button" onClick={() => editarUsuario(usuario)}>Editar</button>
                      <button
                        className={`btn btn-sm ${usuario.twoFactorEnabled ? 'btn-outline-danger' : 'btn-outline-secondary'}`}
                        type="button"
                        onClick={() => void restablecerMfaUsuario(usuario)}
                        disabled={!usuario.twoFactorEnabled || restableciendoMfa !== null}
                        title={usuario.twoFactorEnabled ? 'Eliminar el enrolamiento MFA actual' : 'El usuario no tiene MFA enrolado'}
                      >
                        {restableciendoMfa === usuario.id ? 'Restableciendo…' : 'Restablecer MFA'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!cargando && usuariosFiltrados.length > USUARIOS_POR_PAGINA && (
          <div className="card-footer bg-white d-flex flex-wrap align-items-center justify-content-between gap-2">
            <span className="text-secondary small">
              Mostrando {(paginaVisible - 1) * USUARIOS_POR_PAGINA + 1}–{Math.min(paginaVisible * USUARIOS_POR_PAGINA, usuariosFiltrados.length)} de {usuariosFiltrados.length}
            </span>
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setPaginaActual(paginaVisible - 1)}
                disabled={paginaVisible === 1}
              >
                Anterior
              </button>
              <span className="small">Página {paginaVisible} de {totalPaginas}</span>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setPaginaActual(paginaVisible + 1)}
                disabled={paginaVisible === totalPaginas}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {modalAbierto && (
        <>
          <div className="modal-backdrop fade show" />
          <div className="modal d-block" role="dialog" aria-modal="true" aria-labelledby="user-form-title" tabIndex={-1}>
            <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
              <div className="modal-content">
                <div className="modal-header">
                  <div>
                    <h2 className="modal-title fs-5" id="user-form-title">{usuarioEditar ? 'Editar usuario' : 'Crear usuario'}</h2>
                  </div>
                  <button type="button" className="btn-close" aria-label="Cerrar" onClick={cancelarEdicion} disabled={guardando} />
                </div>
                <form onSubmit={guardarUsuario}>
                  <div className="modal-body">
                    {error && <div className="alert alert-danger" role="alert">{error}</div>}
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label htmlFor="userFirstName" className="form-label">Nombres</label>
                        <input id="userFirstName" className="form-control" value={formulario.nombres} onChange={(event) => setFormulario({ ...formulario, nombres: event.target.value })} required />
                      </div>
                      <div className="col-md-6">
                        <label htmlFor="userLastName" className="form-label">Apellidos</label>
                        <input id="userLastName" className="form-control" value={formulario.apellidosCompleto} onChange={(event) => setFormulario({ ...formulario, apellidosCompleto: event.target.value })} required />
                      </div>
                      <div className="col-md-6">
                        <label htmlFor="userEmail" className="form-label">Correo electrónico</label>
                        <input id="userEmail" type="email" className="form-control" value={formulario.email} onChange={(event) => setFormulario({ ...formulario, email: event.target.value })} required />
                      </div>
                      <div className="col-md-6">
                        <label htmlFor="userPassword" className="form-label">{usuarioEditar ? 'Nueva contraseña (opcional)' : 'Contraseña'}</label>
                        <input id="userPassword" type="password" minLength={8} className="form-control" autoComplete="new-password" value={formulario.password} onChange={(event) => setFormulario({ ...formulario, password: event.target.value })} required={!usuarioEditar} />
                      </div>
                      <div className="col-md-6">
                        <label htmlFor="userRole" className="form-label">Rol</label>
                        <select id="userRole" className="form-select" value={formulario.rol} onChange={(event) => setFormulario({ ...formulario, rol: event.target.value as FormularioUsuario['rol'] })}>
                          {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                        </select>
                      </div>
                      {usuarioEditar && (
                        <div className="col-md-6 d-flex align-items-end">
                          <div className="form-check form-switch mb-2">
                            <input id="userActive" className="form-check-input" type="checkbox" checked={formulario.activo} onChange={(event) => setFormulario({ ...formulario, activo: event.target.checked })} />
                            <label className="form-check-label" htmlFor="userActive">Usuario activo</label>
                          </div>
                        </div>
                      )}
                      <div className="col-12">
                        <div className="form-check form-switch">
                          <input id="mfaRequired" className="form-check-input" type="checkbox" checked={formulario.mfaObligatorio} onChange={(event) => setFormulario({ ...formulario, mfaObligatorio: event.target.checked })} />
                          <label className="form-check-label fw-semibold" htmlFor="mfaRequired">Requerir Autenticación Multifactor (MFA)</label>
                          <div className="form-text">Al activarlo, se exigirá Google Authenticator. Al desactivarlo, el usuario podrá iniciar sesión sin código, aunque conserve su enrolamiento. Use Restablecer MFA para eliminarlo o configurarlo de nuevo.</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button className="btn btn-outline-secondary" type="button" onClick={cancelarEdicion} disabled={guardando}>Cancelar</button>
                    <button className="btn btn-primary" type="submit" disabled={guardando}>
                      {guardando ? 'Guardando…' : usuarioEditar ? 'Guardar cambios' : 'Crear usuario'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
