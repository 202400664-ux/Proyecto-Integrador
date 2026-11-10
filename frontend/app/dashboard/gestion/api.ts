import type { Categoria, DashboardKpis, DescargaActiva, Gateway, Notificacion, Pedido, Proveedor, RolCatalogo } from './types';
import { obtenerNombreUsuarioActual } from '../auth';

export const API_BASE_URL = 'http://localhost:4000/api';

export function encabezadosAutenticados(): Record<string, string> {
  const token = typeof window === 'undefined' ? null : localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface NuevoProveedorPayload {
  razonSocial: string;
  identificacionTributaria: string;
  categoria: string;
  contactoNombre: string;
  telefono: string;
  emailContacto: string;
}

export interface NuevoPedidoPayload {
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

export async function obtenerProveedores(categoria?: Categoria): Promise<Proveedor[]> {
  const query = categoria ? `?categoria=${encodeURIComponent(categoria)}` : '';
  const response = await fetch(`${API_BASE_URL}/proveedores${query}`, { headers: encabezadosAutenticados() });
  const data = await parseOrThrow<{ proveedores: Proveedor[] }>(response);
  return data.proveedores;
}

export interface HorarioOperativo {
  inicio: string;
  fin: string;
}

function formatoHoraParametro(valor: unknown, porDefecto: string): string {
  if (typeof valor !== 'string') return porDefecto;
  const texto = valor.trim();
  const hora = /^(\d{1,2}):([0-5]\d)$/.exec(texto);
  if (hora) {
    const horas = Number(hora[1]);
    if (horas <= 24 && (horas < 24 || Number(hora[2]) === 0)) {
      return `${String(horas).padStart(2, '0')}:${hora[2]}`;
    }
  }

  const valorNumerico = Number(texto);
  if (Number.isFinite(valorNumerico) && valorNumerico >= 0 && valorNumerico <= 24) {
    const minutos = Math.round(valorNumerico * 60);
    return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
  }
  return porDefecto;
}

export async function obtenerHorarioOperativo(): Promise<HorarioOperativo> {
  const response = await fetch(`${API_BASE_URL}/parametros`);
  const data = await parseOrThrow<{ parametros: Array<{ clave: string; valor: string }> }>(response);
  const parametros = new Map(data.parametros.map((parametro) => [parametro.clave, parametro.valor]));
  const horario = {
    inicio: formatoHoraParametro(parametros.get('horario_inicio_operativo'), '07:00'),
    fin: formatoHoraParametro(parametros.get('horario_fin_operativo'), '17:00'),
  };
  return horario.inicio < horario.fin ? horario : { inicio: '07:00', fin: '17:00' };
}

export async function crearProveedor(payload: NuevoProveedorPayload): Promise<Proveedor> {
  const response = await fetch(`${API_BASE_URL}/proveedores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...encabezadosAutenticados() },
    body: JSON.stringify(payload),
  });
  const data = await parseOrThrow<{ proveedor: Proveedor }>(response);
  return data.proveedor;
}

export async function actualizarProveedor(id: string, payload: Partial<NuevoProveedorPayload>): Promise<Proveedor> {
  const response = await fetch(`${API_BASE_URL}/proveedores/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...encabezadosAutenticados() },
    body: JSON.stringify(payload),
  });
  const data = await parseOrThrow<{ proveedor: Proveedor }>(response);
  return data.proveedor;
}

export async function inactivarProveedor(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/proveedores/${id}`, {
    method: 'DELETE',
    headers: { ...encabezadosAutenticados() },
  });
  await parseOrThrow(response);
}

export async function obtenerPedidos(): Promise<Pedido[]> {
  const response = await fetch(`${API_BASE_URL}/pedidos`, { headers: encabezadosAutenticados() });
  const data = await parseOrThrow<{ pedidos: Pedido[] }>(response);
  return data.pedidos;
}

export async function crearPedido(payload: NuevoPedidoPayload): Promise<Pedido> {
  const response = await fetch(`${API_BASE_URL}/pedidos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...encabezadosAutenticados() },
    body: JSON.stringify(payload),
  });
  const data = await parseOrThrow<{ pedido: Pedido }>(response);
  return data.pedido;
}

export async function actualizarPedido(id: string, payload: Partial<NuevoPedidoPayload>): Promise<Pedido> {
  const response = await fetch(`${API_BASE_URL}/pedidos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...encabezadosAutenticados() },
    body: JSON.stringify(payload),
  });
  const data = await parseOrThrow<{ pedido: Pedido }>(response);
  return data.pedido;
}

export async function cancelarPedido(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/pedidos/${id}`, {
    method: 'DELETE',
    headers: { ...encabezadosAutenticados() },
  });
  await parseOrThrow(response);
}

export async function registrarArribo(numeroPedido: string) {
  const response = await fetch('http://localhost:4000/api/llegadas', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...encabezadosAutenticados(),
    },
    body: JSON.stringify({ numeroPedido }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.mensaje || 'Error al procesar la llegada');
  }

  return data;
}

function headersConSesion(): HeadersInit {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export async function obtenerRoles(activo?: boolean): Promise<RolCatalogo[]> {
  const query = activo === undefined ? '' : `?activo=${activo}`;
  const response = await fetch(`${API_BASE_URL}/roles${query}`, { headers: headersConSesion() });
  const data = await parseOrThrow<{ roles: RolCatalogo[] }>(response);
  return data.roles;
}

export async function crearRol(rol: Pick<RolCatalogo, 'nombreRol' | 'descripcion' | 'permisos'>): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/roles`, { method: 'POST', headers: headersConSesion(), body: JSON.stringify(rol) });
  await parseOrThrow(response);
}

export async function actualizarRol(id: string, cambios: Partial<Omit<RolCatalogo, '_id'>>): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/roles/${id}`, { method: 'PUT', headers: headersConSesion(), body: JSON.stringify(cambios) });
  await parseOrThrow(response);
}

export async function desactivarRol(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/roles/${id}`, { method: 'DELETE', headers: headersConSesion() });
  await parseOrThrow(response);
}

export async function obtenerDashboardKpis(): Promise<DashboardKpis> {
  const response = await fetch(`${API_BASE_URL}/dashboard/kpis`, { headers: headersConSesion() });
  return parseOrThrow<DashboardKpis>(response);
}

export async function obtenerGateways(): Promise<Gateway[]> {
  const response = await fetch(`${API_BASE_URL}/gateways`, { headers: headersConSesion() });
  const data = await parseOrThrow<{ gateways: Gateway[] }>(response);
  return data.gateways;
}

export async function obtenerColaPrioridad(): Promise<Pedido[]> {
  const response = await fetch(`${API_BASE_URL}/cola`, { headers: headersConSesion() });
  const data = await parseOrThrow<{ pedidos: Pedido[] }>(response);
  return data.pedidos;
}

export async function obtenerDescargasActivas(): Promise<DescargaActiva[]> {
  const response = await fetch(`${API_BASE_URL}/descargas/activas`, { headers: headersConSesion() });
  const data = await parseOrThrow<{ descargas: DescargaActiva[] }>(response);
  return data.descargas;
}

export async function cambiarEstadoGateway(id: string, estado: 'LIBRE' | 'FUERA DE SERVICIO'): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/gateways/${id}`, {
    method: 'PUT', headers: headersConSesion(), body: JSON.stringify({ estado, usuarioActualizacion: obtenerNombreUsuarioActual() }),
  });
  await parseOrThrow(response);
}

export async function iniciarDescarga(pedidoId: string, gatewayId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/descargas/iniciar`, {
    method: 'POST', headers: headersConSesion(), body: JSON.stringify({ pedidoId, gatewayId }),
  });
  await parseOrThrow(response);
}

export async function finalizarDescarga(descargaId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/descargas/finalizar`, {
    method: 'POST', headers: headersConSesion(), body: JSON.stringify({ descargasId: descargaId }),
  });
  await parseOrThrow(response);
}

export async function obtenerGatewaysInactivos(): Promise<Gateway[]> {
  const response = await fetch(`${API_BASE_URL}/gateways/inactivos`, { headers: headersConSesion() });
  const data = await parseOrThrow<{ gateways: Gateway[] }>(response);
  return data.gateways;
}

export async function inactivarGateway(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/gateways/${id}`, { method: 'DELETE', headers: headersConSesion() });
  await parseOrThrow(response);
}

export async function reactivarGateway(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/gateways/${id}/reactivar`, { method: 'PATCH', headers: headersConSesion() });
  await parseOrThrow(response);
}

export async function obtenerNotificaciones(): Promise<Notificacion[]> {
  const response = await fetch(`${API_BASE_URL}/notificaciones`, { headers: headersConSesion() });
  const data = await parseOrThrow<{ notificaciones: Notificacion[] }>(response);
  return data.notificaciones;
}

export async function reevaluarColaPrioridad(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/cola/reevaluar`, {
    method: 'POST',
    headers: headersConSesion(),
  });
  await parseOrThrow(response);
}