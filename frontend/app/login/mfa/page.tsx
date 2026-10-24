'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import MfaSetupModal from './MfaSetupModal';

const API_URL = 'http://localhost:4000';

interface SetupResponse {
  otpauthUrl: string;
}

export default function MfaLoginPage() {
  const router = useRouter();
  const [tempToken, setTempToken] = useState('');
  const [setupRequired, setSetupRequired] = useState(false);
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [setupAttempt, setSetupAttempt] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const token = sessionStorage.getItem('mfaTempToken');
      if (!token) {
        router.replace('/');
        return;
      }
      setTempToken(token);
      setSetupRequired(sessionStorage.getItem('mfaSetupRequired') === 'true');
    }, 0);
    return () => window.clearTimeout(timer);
  }, [router]);

  useEffect(() => {
    if (!tempToken || !setupRequired) return;

    let active = true;
    const loadSetup = async () => {
      setError('');
      try {
        const response = await fetch(`${API_URL}/api/mfa/setup`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${tempToken}` },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.mensaje || 'No se pudo iniciar el enrolamiento MFA');
        if (active) setOtpauthUrl((data as SetupResponse).otpauthUrl);
      } catch (setupError) {
        if (active) setError(setupError instanceof Error ? setupError.message : 'No se pudo iniciar el enrolamiento MFA');
      }
    };

    void loadSetup();
    return () => { active = false; };
  }, [tempToken, setupRequired, setupAttempt]);

  const enableMfa = useCallback(async (submittedCode: string) => {
    setError('');
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/mfa/enable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tempToken}` },
        body: JSON.stringify({ code: submittedCode }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.mensaje || 'El código no es válido');
      setSetupRequired(false);
      setOtpauthUrl('');
      sessionStorage.setItem('mfaSetupRequired', 'false');
      setMessage('MFA quedó activado. Ingrese un código nuevo para terminar el inicio de sesión.');
    } catch (enableError) {
      setError(enableError instanceof Error ? enableError.message : 'No se pudo activar MFA');
    } finally {
      setLoading(false);
    }
  }, [tempToken]);

  const verifyLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/mfa/verify-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tempToken}` },
        body: JSON.stringify({ code }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.mensaje || 'El código no es válido');
      if (typeof data.token !== 'string') throw new Error('El servidor no devolvió un token de sesión');
      localStorage.setItem('token', data.token);
      sessionStorage.removeItem('mfaTempToken');
      sessionStorage.removeItem('mfaSetupRequired');
      window.dispatchEvent(new Event('sessionchange'));
      router.replace('/dashboard');
    } catch (verificationError) {
      setError(verificationError instanceof Error ? verificationError.message : 'No se pudo verificar el código');
    } finally {
      setLoading(false);
    }
  };

  if (setupRequired && otpauthUrl) {
    return (
      <main className="container py-5">
        <MfaSetupModal otpauthUrl={otpauthUrl} onEnable={enableMfa} error={error} loading={loading} />
      </main>
    );
  }

  return (
    <main className="container py-5">
      <section className="card shadow-sm mx-auto" style={{ maxWidth: 480 }}>
        <div className="card-body p-4">
          <h1 className="h3 mb-2">Verificación en dos pasos</h1>
          <p className="text-secondary">Ingrese el código de seis dígitos de Google Authenticator.</p>
          {message && <div className="alert alert-success py-2" role="status">{message}</div>}
          {error && !(setupRequired && !otpauthUrl) && <div className="alert alert-danger py-2" role="alert">{error}</div>}
          {setupRequired && !otpauthUrl ? (
            <div role={error ? 'alert' : 'status'}>
              <p>{error || 'Preparando el enrolamiento seguro…'}</p>
              {error && <button type="button" className="btn btn-outline-primary" onClick={() => {
                setError('');
                setSetupAttempt((attempt) => attempt + 1);
              }}>Reintentar</button>}
            </div>
          ) : (
            <form onSubmit={verifyLogin}>
              <label htmlFor="loginTotpCode" className="form-label">Código de autenticación</label>
              <input
                id="loginTotpCode"
                className="form-control text-center"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                required
              />
              <button type="submit" className="btn btn-primary w-100 mt-3" disabled={loading || code.length !== 6}>
                {loading ? 'Verificando...' : 'Verificar e iniciar sesión'}
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
