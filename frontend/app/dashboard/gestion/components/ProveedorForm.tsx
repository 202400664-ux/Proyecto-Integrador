'use client';

import { useState, FormEvent } from 'react';
import { ApiError, crearProveedor, type NuevoProveedorPayload } from '../api';
import type { Proveedor } from '../types';
import { formatearTelefono, soloLetras, soloNumeros } from '../validacion';

const ESTADO_INICIAL: NuevoProveedorPayload = {
  razonSocial: '',
  identificacionTributaria: '',
  categoria: '',
  contactoNombre: '',
  telefono: '',
  emailContacto: '',
};

interface ProveedorFormProps {
  onProveedorCreado: (proveedor: Proveedor) => void;
}

export default function ProveedorForm({ onProveedorCreado }: ProveedorFormProps) {
  const [form, setForm] = useState<NuevoProveedorPayload>(ESTADO_INICIAL);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Cada campo se sanea mientras el usuario escribe: no se permite teclear
  // caracteres inválidos en vez de solo rechazarlos hasta enviar el formulario.
  const handleTextoLibre = (campo: keyof NuevoProveedorPayload) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setForm((prev) => ({ ...prev, [campo]: e.target.value }));
  };

  const handleSoloLetras = (campo: keyof NuevoProveedorPayload) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setForm((prev) => ({ ...prev, [campo]: soloLetras(e.target.value) }));
  };

  const handleSoloNumeros = (campo: keyof NuevoProveedorPayload) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setForm((prev) => ({ ...prev, [campo]: soloNumeros(e.target.value) }));
  };

  const handleTelefono = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, telefono: formatearTelefono(e.target.value) }));
  };

  const handleCategoria = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, categoria: e.target.value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setExito('');
    setEnviando(true);

    try {
      const proveedor = await crearProveedor(form);
      setExito(`Proveedor "${proveedor.razonSocial}" registrado correctamente.`);
      setForm(ESTADO_INICIAL);
      onProveedorCreado(proveedor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar el proveedor');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card p-4 shadow-sm border-0 mb-4">
      <h2 className="h5 fw-bold mb-3" style={{ color: '#123149' }}>
        Registrar proveedor
      </h2>

      {error && <div className="alert alert-danger py-2">{error}</div>}
      {exito && <div className="alert alert-success py-2">{exito}</div>}

      <div className="row g-3">
        <div className="col-md-6">
          <label className="form-label">Razón social</label>
          <input
            type="text"
            className="form-control"
            value={form.razonSocial}
            onChange={handleSoloLetras('razonSocial')}
            required
          />
        </div>

        <div className="col-md-6">
          <label className="form-label">Identificación tributaria (RUT/NIT)</label>
          <input
            type="text"
            inputMode="numeric"
            className="form-control"
            value={form.identificacionTributaria}
            onChange={handleSoloNumeros('identificacionTributaria')}
            placeholder="Solo números, sin guiones"
            required
          />
        </div>

        <div className="col-md-6">
          <label className="form-label">Categoría</label>
          <select
            className="form-select"
            value={form.categoria}
            onChange={handleCategoria}
            required
          >
            <option value="" disabled>
              Seleccione una categoría
            </option>
            <option value="construcción">Construcción</option>
            <option value="general">General</option>
          </select>
        </div>

        <div className="col-md-6">
          <label className="form-label">Nombre de contacto</label>
          <input
            type="text"
            className="form-control"
            value={form.contactoNombre}
            onChange={handleSoloLetras('contactoNombre')}
            required
          />
        </div>

        <div className="col-md-6">
          <label className="form-label">Teléfono</label>
          <input
            type="tel"
            className="form-control"
            value={form.telefono}
            onChange={handleTelefono}
            placeholder="0000-0000"
            maxLength={9}
            required
          />
        </div>

        <div className="col-md-6">
          <label className="form-label">Correo de contacto</label>
          <input
            type="email"
            className="form-control"
            value={form.emailContacto}
            onChange={handleTextoLibre('emailContacto')}
            required
          />
        </div>
      </div>

      <button type="submit" className="btn btn-primary mt-4 align-self-start px-4" disabled={enviando}>
        {enviando ? 'Registrando...' : 'Registrar proveedor'}
      </button>
    </form>
  );
}