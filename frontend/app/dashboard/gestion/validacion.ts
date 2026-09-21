/** Filtra el valor dejando solo letras (incluye acentos/ñ) y espacios. */
export function soloLetras(valor: string): string {
  return valor.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]/g, '');
}

/** Filtra el valor dejando solo dígitos. */
export function soloNumeros(valor: string): string {
  return valor.replace(/[^0-9]/g, '');
}

/**
 * Da formato de teléfono salvadoreño ####-#### a medida que se escribe:
 * limita a 8 dígitos y coloca el guion automáticamente después del 4to.
 */
export function formatearTelefono(valor: string): string {
  const digitos = soloNumeros(valor).slice(0, 8);
  if (digitos.length <= 4) return digitos;
  return `${digitos.slice(0, 4)}-${digitos.slice(4)}`;
}

export const REGEX_SOLO_LETRAS = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]+$/;
export const REGEX_SOLO_NUMEROS = /^[0-9]+$/;
export const REGEX_TELEFONO = /^\d{4}-\d{4}$/;