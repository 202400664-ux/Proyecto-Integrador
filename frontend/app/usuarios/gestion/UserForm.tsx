'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';

const API_URL = 'http://localhost:4000';
const ROLES = ['administrador', 'coordinador', 'operador'] as const;

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
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

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
  };

  const cancelarEdicion = () => {
    setUsuarioEditar(null);
    setFormulario(FORMULARIO_VACIO);
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

  return (
    <section>
      <header className="mb-4">
        <p className="text-uppercase text-secondary fw-semibold mb-1">Gobernanza y acceso</p>
        <h2>Administración de usuarios</h2>
        <p className="text-secondary mb-0">Gestione los roles y el requisito de autenticación multifactor por usuario.</p>
      </header>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {mensaje && <div className="alert alert-success" role="status">{mensaje}</div>}

      <div className="card shadow-sm mb-4">
        <div className="card-header bg-white fw-semibold">{usuarioEditar ? 'Editar usuario' : 'Crear usuario'}</div>
        <div className="card-body">
          <form onSubmit={guardarUsuario}>
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
                  <div className="form-text">Al activarlo, el usuario deberá enrolar Google Authenticator en su siguiente inicio de sesión.</div>
                </div>
              </div>
              <div className="col-12 d-flex gap-2">
                <button className="btn btn-primary" type="submit" disabled={guardando}>
                  {guardando ? 'Guardando…' : usuarioEditar ? 'Guardar cambios' : 'Crear usuario'}
                </button>
                {usuarioEditar && <button className="btn btn-outline-secondary" type="button" onClick={cancelarEdicion}>Cancelar</button>}
              </div>
            </div>
          </form>
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="card-header bg-white fw-semibold">Usuarios registrados</div>
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
              ) : usuarios.map((usuario) => (
                <tr key={usuario.id}>
                  <td>{usuario.nombres} {usuario.apellidosCompleto}</td>
                  <td>{usuario.email}</td>
                  <td className="text-capitalize">{usuario.rol}</td>
                  <td><span className={`badge ${usuario.activo ? 'text-bg-success' : 'text-bg-secondary'}`}>{usuario.activo ? 'Activo' : 'Inactivo'}</span></td>
                  <td>{usuario.mfaObligatorio ? 'Sí' : 'No'}</td>
                  <td>{usuario.twoFactorEnabled ? 'Sí' : 'No'}</td>
                  <td><button className="btn btn-sm btn-outline-primary" type="button" onClick={() => editarUsuario(usuario)}>Editar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
