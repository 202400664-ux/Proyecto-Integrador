import type { Pedido, Proveedor } from './types';

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

export async function obtenerProveedores(): Promise<Proveedor[]> {
  const response = await fetch(`${API_BASE_URL}/proveedores`);
  const data = await parseOrThrow<{ proveedores: Proveedor[] }>(response);
  return data.proveedores;
}

export async function crearProveedor(payload: NuevoProveedorPayload): Promise<Proveedor> {
  const response = await fetch(`${API_BASE_URL}/proveedores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await parseOrThrow<{ proveedor: Proveedor }>(response);
  return data.proveedor;
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
    body: JSON.stringify(payload),
  });
  const data = await parseOrThrow<{ pedido: Pedido }>(response);
  return data.pedido;
}