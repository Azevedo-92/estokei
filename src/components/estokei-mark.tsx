import { BRAND_DARK, BRAND_PRIMARY, MARK_FACES } from '@/lib/brand-mark'

/**
 * Marca oficial do Estokei: a caixa laranja à esquerda, seguida do texto
 * "Estok" (grafite) + "ei" (laranja). Usada em toda a aplicação e como
 * fallback quando a empresa não tem logo. O desenho fica em src/lib/brand-mark.ts.
 */
export function EstokeiMark({
  className = '',
  showText = true,
}: {
  className?: string
  showText?: boolean
}) {
  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <svg aria-hidden width="30" height="30" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        {[MARK_FACES.top, MARK_FACES.left, MARK_FACES.right].map((f) => (
          <path key={f.d} d={f.d} fill={f.fill} stroke={f.fill} strokeWidth="1.5" strokeLinejoin="round" />
        ))}
        <path d={MARK_FACES.tape.d} stroke={MARK_FACES.tape.stroke} strokeWidth="2.5" strokeLinecap="round" />
      </svg>

      {showText ? (
        <span className="font-semibold tracking-tight text-[26px] leading-none">
          <span style={{ color: BRAND_DARK }}>Estok</span>
          <span style={{ color: BRAND_PRIMARY }}>ei</span>
        </span>
      ) : null}
    </div>
  )
}
