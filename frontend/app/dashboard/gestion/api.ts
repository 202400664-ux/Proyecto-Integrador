import type { Pedido, Proveedor } from './types';
import { obtenerNombreUsuarioActual } from '../auth';

export const API_BASE_URL = 'http://localhost:4000/api';

export interface NuevoProveedorPayload {
  razonSocial: string;
  identificacionTributaria: string;
  categoria: string;
  contactoNombre: string;
  telefono: string;
  emailContacto: string;
}

export interface NuevoPedidoPayload {
  numeroPedido: string;
  proveedorId: string;
  tipoProducto: string;
  fechaHoraProgramada: string;
  inicioVentana: string;
  finVentana: string;
  duracionEstimadaMinutos: number;
}

export interface ResultadoLlegada {
  mensaje: string;
  estadoCalculado: Pedido['estado'];
  pedido: Pedido & { fechaHoraLlegadaReal: string };
}

/** Error tipado que conserva el cuerpo JSON devuelto por la API (mensaje, alternativas, etc.). */
export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown, mensaje: string) {
    super(mensaje);
    this.status = status;
    this.body = body;
  }
}

async function parseOrThrow<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const mensaje = typeof data?.mensaje === 'string' ? data.mensaje : 'Ocurrió un error inesperado';
    throw new ApiError(response.status, data, mensaje);
  }
  return data as T;
}

export async function obtenerProveedores(categoria?: string): Promise<Proveedor[]> {
  const query = categoria ? `?categoria=${encodeURIComponent(categoria)}` : '';
  const response = await fetch(`${API_BASE_URL}/proveedores${query}`);
  const data = await parseOrThrow<{ proveedores: Proveedor[] }>(response);
  return data.proveedores;
}

export async function crearProveedor(payload: NuevoProveedorPayload): Promise<Proveedor> {
  const response = await fetch(`${API_BASE_URL}/proveedores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, usuarioCreacion: obtenerNombreUsuarioActual() }),
  });
  const data = await parseOrThrow<{ proveedor: Proveedor }>(response);
  return data.proveedor;
}

export async function actualizarProveedor(id: string, payload: Partial<NuevoProveedorPayload>): Promise<Proveedor> {
  const response = await fetch(`${API_BASE_URL}/proveedores/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, usuarioActualizacion: obtenerNombreUsuarioActual() }),
  });
  const data = await parseOrThrow<{ proveedor: Proveedor }>(response);
  return data.proveedor;
}

export async function inactivarProveedor(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/proveedores/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuarioActualizacion: obtenerNombreUsuarioActual() }),
  });
  await parseOrThrow(response);
}

export async function obtenerPedidos(): Promise<Pedido[]> {
  const response = await fetch(`${API_BASE_URL}/pedidos`);
  const data = await parseOrThrow<{ pedidos: Pedido[] }>(response);
  return data.pedidos;
}

export async function crearPedido(payload: NuevoPedidoPayload): Promise<Pedido> {
  const response = await fetch(`${API_BASE_URL}/pedidos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, usuarioCreacion: obtenerNombreUsuarioActual() }),
  });
  const data = await parseOrThrow<{ pedido: Pedido }>(response);
  return data.pedido;
}

export async function actualizarPedido(id: string, payload: Partial<NuevoPedidoPayload>): Promise<Pedido> {
  const response = await fetch(`${API_BASE_URL}/pedidos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, usuarioActualizacion: obtenerNombreUsuarioActual() }),
  });
  const data = await parseOrThrow<{ pedido: Pedido }>(response);
  return data.pedido;
}

export async function cancelarPedido(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/pedidos/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuarioActualizacion: obtenerNombreUsuarioActual() }),
  });
  await parseOrThrow(response);
}

export async function registrarArribo(numeroPedido: string, usuarioNombre: string): Promise<ResultadoLlegada> {
  const token = localStorage.getItem('token');
  const response = await fetch('http://localhost:4000/api/llegadas', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ numeroPedido, usuarioNombre }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.mensaje || 'Error al procesar la llegada');
  }

  return data as ResultadoLlegada;
}