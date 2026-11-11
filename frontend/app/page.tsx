'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { leerSesionDeToken } from './dashboard/permisos';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    sessionStorage.removeItem('mfaTempToken');
    sessionStorage.removeItem('mfaSetupRequired');

    try {
      const response = await fetch('http://localhost:4000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.mensaje || 'Error al iniciar sesión');
      }

      if (data.mfaRequired === true) {
        if (typeof data.tempToken !== 'string') {
          throw new Error('El servidor no devolvió un token temporal de MFA');
        }
        localStorage.removeItem('token');
        sessionStorage.setItem('mfaTempToken', data.tempToken);
        sessionStorage.setItem('mfaSetupRequired', String(data.mfaSetupRequired === true));
        router.replace('/login/mfa');
        return;
      }

      if (typeof data.token !== 'string') {
        throw new Error('El servidor no devolvió un token de sesión');
      }

      // Decodificar y validar el JWT antes de persistir la sesión.
      if (!leerSesionDeToken(data.token)) {
        throw new Error('La sesión recibida no es válida');
      }

      localStorage.setItem('token', data.token);

      // Redirección al dashboard único: la UI se adapta por permisos según
      // el rol decodificado del token (no hay una ruta/interfaz por rol).
      router.replace('/dashboard');
    } catch (err: unknown) {
      localStorage.removeItem('token');
      sessionStorage.removeItem('mfaTempToken');
      sessionStorage.removeItem('mfaSetupRequired');
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-shell">
      <section className="login-intro">
        <div className="login-brand">
          <span>Centro de distribución</span>
        </div>
        <div className="login-copy">
          <h1>Sistema de Gestión Logística</h1>
          <p className="login-lead">
            Recepción y desembarque de proveedores en un solo lugar.
          </p>
        </div>
      </section>

      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-form-wrap">
          <p className="login-panel-label">Acceso al sistema</p>
          <h2 id="login-title">Iniciar Sesión</h2>

          {error && (
            <div className="alert alert-danger py-2" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="emailInput" className="form-label">
                Correo Electrónico
              </label>
              <input
                type="email"
                className="form-control"
                id="emailInput"
                placeholder="ejemplo@dominio.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="mb-3">
              <label htmlFor="passwordInput" className="form-label">
                Contraseña
              </label>
              <input
                type="password"
                className="form-control"
                id="passwordInput"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary w-100 login-submit"
              disabled={loading}
            >
              {loading ? 'Ingresando...' : 'Iniciar Sesión'}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}