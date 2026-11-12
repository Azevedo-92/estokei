// ---- Brand default do Estokei ------------------------------------------

/** Cor primária default quando a organização ainda não personalizou. */
export const DEFAULT_BRAND_COLOR = '#ea580c'

/** Valida se uma string é hex de cor (#RGB, #RRGGBB). */
export function isValidHexColor(value: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)
}

/** Retorna a cor da org com fallback pro default. */
export function resolveBrandColor(color: string | null | undefined): string {
  return color && isValidHexColor(color) ? color : DEFAULT_BRAND_COLOR
}

/** Calcula luminância aproximada de uma cor hex — usada para escolher texto claro/escuro em cima dela. */
export function contrastText(hex: string): string {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#111827' : '#ffffff'
}
