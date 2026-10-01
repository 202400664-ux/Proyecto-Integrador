'use client';
import React, { useState } from 'react';
import { registrarArribo } from '../api';

// 1. Declarar la prop en la interfaz
interface CasetaArribosFormProps {
  onArriboRegistrado?: () => void;
}

interface ResultadoArribo {
  estadoCalculado: string;
  pedido: {
    fechaHoraLlegadaReal: string;
  };
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
            placeholder="Ej. PED-1001"
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
          </div>
        )}
      </div>
    </div>
  );
}