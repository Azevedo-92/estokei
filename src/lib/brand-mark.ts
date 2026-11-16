// Desenho do símbolo do Estokei (uma caixa de estoque em perspectiva), num só
// lugar: usado pelo componente EstokeiMark, pelos ícones, pela imagem de prévia
// dos links e pelo logo dos e-mails. O arquivo estático src/app/icon.svg repete
// estes caminhos — mudou aqui, mude lá.
//
// Geometria (viewBox 0 0 40 40): tampa em losango (topo) e duas faces laterais,
// cada uma com um tom de laranja para dar volume.

/** Laranja principal da marca (botões e destaque do nome). */
export const BRAND_PRIMARY = '#ea580c'
/** Grafite do texto "Estok". */
export const BRAND_DARK = '#0f172a'

export const MARK_FACES = {
  top: { d: 'M20 4 L35 11.5 L20 19 L5 11.5 Z', fill: '#fb923c' },
  left: { d: 'M5 11.5 L20 19 L20 36 L5 28.5 Z', fill: '#ea580c' },
  right: { d: 'M35 11.5 L20 19 L20 36 L35 28.5 Z', fill: '#c2410c' },
  /** Fita da tampa: dá a cara de "caixa de papelão". */
  tape: { d: 'M12.5 7.75 L27.5 15.25', stroke: '#fff7ed' },
} as const

/** SVG completo do símbolo (para <img src="data:..."> em imagens geradas). */
export function markSvg(): string {
  const face = (f: { d: string; fill: string }) =>
    `<path d="${f.d}" fill="${f.fill}" stroke="${f.fill}" stroke-width="1.5" stroke-linejoin="round"/>`
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none">' +
    face(MARK_FACES.top) +
    face(MARK_FACES.left) +
    face(MARK_FACES.right) +
    `<path d="${MARK_FACES.tape.d}" stroke="${MARK_FACES.tape.stroke}" stroke-width="2.5" stroke-linecap="round"/>` +
    '</svg>'
  )
}

export function markDataUrl(): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(markSvg())}`
}
