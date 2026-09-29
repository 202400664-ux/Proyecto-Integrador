'use client';

import { useState, FormEvent } from 'react';
import { ApiError, actualizarPedido, crearPedido, type NuevoPedidoPayload } from '../api';
import type { ConflictoPedido, Pedido, Proveedor, VentanaAlternativa } from '../types';

interface FormState {
  numeroPedido: string;
  proveedorId: string;
  tipoProducto: string;
  fechaHoraProgramada: string;
  inicioVentana: string;
  finVentana: string;
  duracionEstimadaMinutos: string;
}

const ESTADO_INICIAL: FormState = {
  numeroPedido: '',
  proveedorId: '',
  tipoProducto: '',
  fechaHoraProgramada: '',
  inicioVentana: '',
  finVentana: '',
  duracionEstimadaMinutos: '',
};

/** Convierte un Date a un valor compatible con <input type="datetime-local"> en hora local. */
function aDatetimeLocal(fecha: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}T${pad(
    fecha.getHours()
  )}:${pad(fecha.getMinutes())}`;
}

function formatoLegible(isoOrLocal: string): string {
  const fecha = new Date(isoOrLocal);
  return fecha.toLocaleString('es-SV', { dateStyle: 'medium', timeStyle: 'short' });
}

function estadoInicialPedido(pedido?: Pedido | null): FormState {
  if (!pedido) return ESTADO_INICIAL;
  return {
    numeroPedido: pedido.numeroPedido,
    proveedorId: typeof pedido.proveedorId === 'string' ? pedido.proveedorId : pedido.proveedorId._id,
    tipoProducto: pedido.tipoProducto,
    fechaHoraProgramada: aDatetimeLocal(new Date(pedido.inicioVentana)),
    inicioVentana: aDatetimeLocal(new Date(pedido.inicioVentana)),
    finVentana: aDatetimeLocal(new Date(pedido.finVentana)),
    duracionEstimadaMinutos: String(pedido.duracionEstimadaMinutos),
  };
}

interface PedidoFormProps {
  proveedores: Proveedor[];
  onPedidoCreado: (pedido: Pedido) => void;
  pedidoEditar?: Pedido | null;
  onPedidoActualizado?: (pedido: Pedido) => void;
  onCancelarEdicion?: () => void;
}

export default function PedidoForm({ proveedores, onPedidoCreado, pedidoEditar, onPedidoActualizado, onCancelarEdicion }: PedidoFormProps) {
  const [form, setForm] = useState<FormState>(() => estadoInicialPedido(pedidoEditar));
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [conflicto, setConflicto] = useState<ConflictoPedido | null>(null);
  const [enviando, setEnviando] = useState(false);

  const handleChange = (campo: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [campo]: e.target.value }));
  };

  const aplicarAlternativa = (alternativa: VentanaAlternativa) => {
    setForm((prev) => ({
      ...prev,
      inicioVentana: aDatetimeLocal(new Date(alternativa.inicioVentana)),
      finVentana: aDatetimeLocal(new Date(alternativa.finVentana)),
      fechaHoraProgramada: aDatetimeLocal(new Date(alternativa.inicioVentana)),
    }));
    setConflicto(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setExito('');
    setConflicto(null);
    setEnviando(true);

    // fechaHoraProgramada corresponde al inicio de la ventana: no tiene sentido pedirlo
    // aparte, así que se deriva automáticamente para no duplicar el dato en el formulario.
    const payload: NuevoPedidoPayload = {
      numeroPedido: form.numeroPedido,
      proveedorId: form.proveedorId,
      tipoProducto: form.tipoProducto,
      fechaHoraProgramada: form.inicioVentana ? new Date(form.inicioVentana).toISOString() : '',
      inicioVentana: form.inicioVentana ? new Date(form.inicioVentana).toISOString() : '',
      finVentana: form.finVentana ? new Date(form.finVentana).toISOString() : '',
      duracionEstimadaMinutos: Number(form.duracionEstimadaMinutos),
    };

    try {
      const pedido = pedidoEditar
        ? await actualizarPedido(pedidoEditar._id, payload)
        : await crearPedido(payload);
      setExito(`Pedido "${pedido.numeroPedido}" ${pedidoEditar ? 'actualizado' : 'programado'} correctamente.`);
      setForm(ESTADO_INICIAL);
      if (pedidoEditar) onPedidoActualizado?.(pedido);
      else onPedidoCreado(pedido);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && (err.body as ConflictoPedido)?.ventanasAlternativas) {
        setConflicto(err.body as ConflictoPedido);
        setError(err.message);
      } else {
        setError(err instanceof ApiError ? err.message : 'No se pudo programar el pedido');
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card p-4 shadow-sm border-0 mb-4">
      <h2 className="h5 fw-bold mb-3" style={{ color: '#123149' }}>
        {pedidoEditar ? 'Editar pedido' : 'Programar pedido (cita)'}
      </h2>

      {error && <div className="alert alert-danger py-2 mb-2">{error}</div>}
      {exito && <div className="alert alert-success py-2 mb-2">{exito}</div>}

      {conflicto && (
        <div className="alert alert-warning py-2">
          <p className="mb-2">
            Conflicto con el pedido <strong>{conflicto.conflictoCon.numeroPedido}</strong> (
            {formatoLegible(conflicto.conflictoCon.inicioVentana)} -{' '}
            {formatoLegible(conflicto.conflictoCon.finVentana)}). Ventanas alternativas disponibles:
          </p>
          <div className="d-flex flex-wrap gap-2">
            {conflicto.ventanasAlternativas.map((alt, i) => (
              <button
                type="button"
                key={i}
                className="btn btn-outline-primary btn-sm"
                onClick={() => aplicarAlternativa(alt)}
              >
                {formatoLegible(alt.inicioVentana)} - {formatoLegible(alt.finVentana)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="row g-3">
        <div className="col-md-6">
          <label className="form-label">Número de pedido</label>
          <input
            type="text"
            className="form-control"
            value={form.numeroPedido}
            onChange={handleChange('numeroPedido')}
            required
          />
        </div>

        <div className="col-md-6">
          <label className="form-label">Proveedor</label>
          <select
            className="form-select"
            value={form.proveedorId}
            onChange={handleChange('proveedorId')}
            required
          >
            <option value="" disabled>
              {proveedores.length === 0 ? 'No hay proveedores registrados' : 'Seleccione un proveedor'}
            </option>
            {proveedores.map((p) => (
              <option key={p._id} value={p._id}>
                {p.razonSocial} ({p.identificacionTributaria})
              </option>
            ))}
          </select>
        </div>

        <div className="col-md-6">
          <label className="form-label">Tipo de producto</label>
          <select
            className="form-select"
            value={form.tipoProducto}
            onChange={handleChange('tipoProducto')}
            required
          >
            <option value="" disabled>
              Seleccione un tipo
            </option>
            <option value="construcción">Construcción</option>
            <option value="general">General</option>
          </select>
        </div>

        <div className="col-md-6">
          <label className="form-label">Duración estimada (minutos)</label>
          <input
            type="number"
            min={1}
            className="form-control"
            value={form.duracionEstimadaMinutos}
            onChange={handleChange('duracionEstimadaMinutos')}
            required
          />
        </div>

        <div className="col-md-6">
          <label className="form-label">Inicio de ventana</label>
          <input
            type="datetime-local"
            className="form-control"
            value={form.inicioVentana}
            onChange={handleChange('inicioVentana')}
            required
          />
        </div>

        <div className="col-md-6">
          <label className="form-label">Fin de ventana</label>
          <input
            type="datetime-local"
            className="form-control"
            value={form.finVentana}
            onChange={handleChange('finVentana')}
            required
          />
        </div>
      </div>

      <p className="text-secondary small mt-3 mb-0">
        Horario operativo configurado en parámetros, de lunes a sábado.
      </p>

      <button type="submit" className="btn btn-primary mt-3 align-self-start px-4" disabled={enviando}>
        {enviando ? 'Guardando...' : pedidoEditar ? 'Guardar cambios' : 'Programar pedido'}
      </button>
      {pedidoEditar && (
        <button type="button" className="btn btn-link mt-3 ms-2" onClick={onCancelarEdicion}>
          Cancelar edición
        </button>
      )}
    </form>
  );
}