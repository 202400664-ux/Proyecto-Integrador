export function validarNombreCompleto(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const nombre = valor.trim().replace(/\s+/g, ' ');
  return nombre.split(' ').length >= 2 ? nombre : null;
}