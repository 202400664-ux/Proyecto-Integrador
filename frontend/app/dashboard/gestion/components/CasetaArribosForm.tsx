'use client';
import React, { useState } from 'react';
import { registrarArribo } from '../api';

// 1. Declarar la prop en la interfaz
interface CasetaArribosFormProps {
  onArriboRegistrado?: () => void;
}

interface ResultadoArribo {
  estadoCalculado: string;
  advertencia?: string;
  pedido: {
    fechaHoraLlegadaReal: string;
    estado: string;
    gatewayId?: string | { numeroGateway: number };
  };
}

function mensajeEstadoCola(resultado: ResultadoArribo): string {
  const { pedido } = resultado;
  if (pedido.estado === 'GATEWAY ASIGNADO') {
    const numeroGateway = typeof pedido.gatewayId === 'object' ? pedido.gatewayId.numeroGateway : undefined;
    return numeroGateway
      ? `El pedido fue asignado automáticamente al Gateway ${numeroGateway} según su prioridad y tipo de carga.`
      : 'El pedido fue asignado automáticamente a un gateway compatible.';
  }
  if (pedido.estado === 'EN COLA') {
    return 'El pedido se agregó automáticamente a la cola. Se asignará cuando haya una bahía compatible disponible.';
  }
  if (pedido.estado === 'ANTICIPADO') {
    return 'El pedido se clasificó como anticipado y se está procesando su ingreso a la cola con esa prioridad.';
  }
  return '';
}

// 2. Recibir la prop en el componente
export default function CasetaArribosForm({ onArriboRegistrado }: CasetaArribosFormProps) {
  const [numPedido, setNumPedido] = useState('');
  const [resultado, setResultado] = useState<ResultadoArribo | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResultado(null);
    setCargando(true);

    try {
      const data = await registrarArribo(numPedido);
      setResultado(data);
      setNumPedido('');

      // 3. Llamar la función al terminar con éxito
      if (onArriboRegistrado) {
        onArriboRegistrado();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al registrar el arribo');
    } finally {
      setCargando(false);
    }
  };

  const getBadgeColor = (estado: string) => {
    switch (estado) {
      case 'A TIEMPO': return 'bg-success';
      case 'ANTICIPADO': return 'bg-warning text-dark';
      case 'TARDÍO': return 'bg-danger';
      default: return 'bg-secondary';
    }
  };

  return (
    <div className="caseta-arribo-shell">
      <div className="caseta-arribo-card">
        <div className="caseta-arribo-header">
          <div>
            <p className="caseta-kicker">Recepción</p>
            <h2>Caseta de Arribos</h2>
          </div>
          <span className="caseta-indicator">Operativo</span>
        </div>

        <form onSubmit={handleSubmit} className="caseta-arribo-form">
          <label className="form-label fw-semibold">Número de pedido</label>
          <input
            type="text"
            className="form-control form-control-lg"
            placeholder="Ej. PED-EQUI04-000000001"
            value={numPedido}
            onChange={(e) => setNumPedido(e.target.value)}
            required
          />

          <button
            type="submit"
            className="btn btn-primary btn-lg w-100 fw-bold mt-3"
            disabled={cargando}
          >
            {cargando ? 'Procesando...' : 'Registrar llegada'}
          </button>
        </form>

        {error && <div className="alert alert-danger mt-3 mb-0">{error}</div>}

        {resultado && (
          <div className="caseta-result-panel">
            <div className="caseta-result-top">
              <span className="caseta-result-label">Estado calculado</span>
              <span className={`badge ${getBadgeColor(resultado.estadoCalculado)} fs-6 py-2`}>{resultado.estadoCalculado}</span>
            </div>
            <div className="caseta-result-meta">
              <strong>Hora de llegada:</strong> {new Date(resultado.pedido.fechaHoraLlegadaReal).toLocaleTimeString()}
            </div>
            {resultado.advertencia ? (
              <div className="alert alert-warning mt-3 mb-0" role="status">{resultado.advertencia}</div>
            ) : mensajeEstadoCola(resultado) ? (
              <p className="mt-3 mb-0">{mensajeEstadoCola(resultado)}</p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}