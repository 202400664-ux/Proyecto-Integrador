/**
 * Reglas de negocio puras de SumaControl (sin acceso a base de datos).
 * Se aíslan aquí para poder probarlas de forma unitaria.
 */

export type ClasificacionPuntualidad = 'ANTICIPADO' | 'A TIEMPO' | 'TARDÍO';
export type TipoCarga = 'general' | 'construcción';
export type EstadoBahia = 'LIBRE' | 'OCUPADO' | 'FUERA DE SERVICIO';

export interface VentanaCita {
  inicioVentana: Date | string;
  finVentana: Date | string;
}

export interface ToleranciasMinutos {
  anticipado: number;
  tardio: number;
}

export interface BahiaEvaluada {
  numeroGateway: number;
  estado?: EstadoBahia;
  activo?: boolean;
}

/** Número de la bahía exclusiva para carga de construcción (RN-08). */
export const GATEWAY_CONSTRUCCION = 5;

/** Valores por defecto de RN-04 y RN-05 cuando no existen en la colección parametros. */
export const TOLERANCIAS_POR_DEFECTO = {
  anticipado: 15,
  tardio: 15,
  ausente: 30,
} as const;

/**
 * RN-04: clasifica la llegada contra la ventana de la cita y sus tolerancias.
 * Los límites son inclusivos: llegar exactamente en el borde de la tolerancia es A TIEMPO.
 */
export function evaluarTolerancia(
  llegada: Date | string,
  ventana: VentanaCita,
  tolerancias: ToleranciasMinutos
): ClasificacionPuntualidad {
  const momento = new Date(llegada).getTime();
  const inicio = new Date(ventana.inicioVentana).getTime();
  const fin = new Date(ventana.finVentana).getTime();
  if ([momento, inicio, fin].some((valor) => Number.isNaN(valor))) {
    throw new Error('Fechas inválidas para evaluar la tolerancia');
  }
  if (fin < inicio) {
    throw new Error('El fin de la ventana no puede ser anterior a su inicio');
  }
  const margenAnticipado = Math.max(0, tolerancias.anticipado) * 60_000;
  const margenTardio = Math.max(0, tolerancias.tardio) * 60_000;

  if (momento < inicio - margenAnticipado) return 'ANTICIPADO';
  if (momento > fin + margenTardio) return 'TARDÍO';
  return 'A TIEMPO';
}

/**
 * RN-07 y RN-08: el Gateway 5 es exclusivo para construcción y los Gateways 1 a 4
 * atienden carga general. Una bahía inactiva o fuera de servicio no es compatible.
 */
export function validarCompatibilidadBahia(bahia: BahiaEvaluada, tipoCarga: TipoCarga): boolean {
  if (bahia.activo === false) return false;
  if (bahia.estado === 'FUERA DE SERVICIO') return false;
  if (!Number.isInteger(bahia.numeroGateway) || bahia.numeroGateway < 1 || bahia.numeroGateway > 5) return false;
  return bahia.numeroGateway === GATEWAY_CONSTRUCCION
    ? tipoCarga === 'construcción'
    : tipoCarga === 'general';
}

/** RN-01: formato del número de pedido correlativo PED-EQUI##-#########. */
export function formatearNumeroPedido(equipo: number, correlativo: number): string {
  if (!Number.isInteger(equipo) || equipo < 1 || equipo > 99) {
    throw new Error('El número de equipo debe estar entre 1 y 99');
  }
  if (!Number.isInteger(correlativo) || correlativo < 1 || correlativo > 999_999_999) {
    throw new Error('El correlativo debe estar entre 1 y 999999999');
  }
  return `PED-EQUI${String(equipo).padStart(2, '0')}-${String(correlativo).padStart(9, '0')}`;
}

export function esNumeroPedidoValido(numero: string): boolean {
  return /^PED-EQUI\d{2}-\d{9}$/.test(numero);
}
