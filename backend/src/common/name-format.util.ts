/**
 * Normaliza un nombre completo a formato de título (Primera letra de cada palabra en mayúscula).
 * Garantiza uniformidad independientemente de cómo fue ingresado en la BD.
 */
export function formatPlayerName(
  nombres: string | null | undefined,
  apellidos: string | null | undefined,
  fallback?: string,
): string {
  const raw = `${nombres || ''} ${apellidos || ''}`.trim();
  const name = raw || fallback || '';
  return toTitleCase(name);
}

/**
 * Convierte un string a Title Case (primera letra de cada palabra en mayúscula).
 */
export function toTitleCase(str: string): string {
  if (!str) return str;
  return str
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
