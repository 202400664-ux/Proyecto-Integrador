'use client';

import { useState, type FormEvent } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface MfaSetupModalProps {
  otpauthUrl: string;
  onEnable: (code: string) => Promise<void>;
  error: string;
  loading: boolean;
}

export default function MfaSetupModal({ otpauthUrl, onEnable, error, loading }: MfaSetupModalProps) {
  const [code, setCode] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onEnable(code);
  };

  return (
    <div className="modal d-block" role="dialog" aria-modal="true" aria-labelledby="mfa-setup-title">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 shadow">
          <div className="modal-header">
            <h1 className="modal-title fs-5" id="mfa-setup-title">Configurar Google Authenticator</h1>
          </div>
          <div className="modal-body">
            <p>Escanee este código QR con Google Authenticator y escriba el código de seis dígitos que aparece en la aplicación.</p>
            <div className="d-flex justify-content-center p-3 mb-3 bg-white border rounded">
              <QRCodeSVG value={otpauthUrl} size={208} level="M" includeMargin />
            </div>
            {error && <div className="alert alert-danger py-2" role="alert">{error}</div>}
            <form onSubmit={handleSubmit}>
              <label htmlFor="setupTotpCode" className="form-label">Código de verificación</label>
              <input
                id="setupTotpCode"
                className="form-control text-center"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                aria-describedby="setup-code-help"
              />
              <div id="setup-code-help" className="form-text">El código cambia cada 30 segundos.</div>
              <button type="submit" className="btn btn-primary w-100 mt-3" disabled={loading || code.length !== 6}>
                {loading ? 'Verificando...' : 'Activar MFA'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
