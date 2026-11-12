// PNG da marca Estokei para uso em cabeçalhos de e-mail.
// Renderiza a caixa laranja + "Estokei" numa faixa horizontal.
// Cacheado por 30 dias no CDN da Vercel — a marca não muda em tempo real.

import { ImageResponse } from 'next/og'
import { BRAND_DARK, BRAND_PRIMARY, markDataUrl } from '@/lib/brand-mark'

export const runtime = 'edge'


export async function GET() {
  const svgUrl = markDataUrl()
  const res = new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '18px 28px',
          background: 'white',
          width: '100%',
          height: '100%',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={svgUrl} alt="" width={54} height={54} />
        <div
          style={{
            display: 'flex',
            fontSize: 44,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            lineHeight: 1,
          }}
        >
          {/* O gerador (next/og) põe um espaço entre textos de cores diferentes; a
              margem negativa junta "Estok" e "ei" numa palavra só. */}
          <span style={{ color: BRAND_DARK }}>Estok</span>
          <span style={{ color: BRAND_PRIMARY, marginLeft: '-0.14em' }}>ei</span>
        </div>
      </div>
    ),
    { width: 440, height: 90 }
  )
  res.headers.set('cache-control', 'public, max-age=2592000, immutable')
  return res
}
