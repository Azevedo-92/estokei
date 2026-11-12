import { ImageResponse } from 'next/og'
import { BRAND_DARK, BRAND_PRIMARY, markDataUrl } from '@/lib/brand-mark'

// Imagem que aparece quando alguém compartilha um link do site (WhatsApp,
// LinkedIn, Instagram, Facebook, X). Vale para todas as páginas que não têm a
// própria. Mesma caixa de app/apple-icon.tsx.

export const alt = 'Estokei — PDV, estoque e financeiro para o seu comércio'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const STOCK = [
  { name: 'Cimento 50 kg', qty: '128 un', ok: true },
  { name: 'Tinta acrílica 18 L', qty: '6 un', ok: false },
  { name: 'Parafuso 6 mm (cx)', qty: '54 cx', ok: true },
  { name: 'Lâmpada LED 9 W', qty: '3 un', ok: false },
]

export default function OpengraphImage() {
  const markUrl = markDataUrl()
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          padding: '64px 72px',
          background: 'linear-gradient(135deg, #ffffff 0%, #fff7ed 60%, #ffedd5 100%)',
          fontFamily: 'sans-serif',
          color: BRAND_DARK,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', width: 620 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={markUrl} alt="" width={64} height={64} />
            {/* O gerador (next/og) põe um espaço entre textos de cores diferentes; a
                margem negativa junta "Estok" e "ei" numa palavra só. */}
            <div style={{ display: 'flex', fontSize: 52, fontWeight: 700, letterSpacing: -1 }}>
              <span style={{ color: BRAND_DARK }}>Estok</span>
              <span style={{ color: BRAND_PRIMARY, marginLeft: '-0.14em' }}>ei</span>
            </div>
          </div>
          <div style={{ marginTop: 56, fontSize: 60, fontWeight: 700, lineHeight: 1.08, letterSpacing: -2 }}>
            Vendeu? Estokei.
          </div>
          <div style={{ marginTop: 28, fontSize: 28, lineHeight: 1.35, color: '#475569' }}>
            PDV, controle de estoque, orçamentos e financeiro para o seu comércio.
          </div>
          <div style={{ marginTop: 'auto', fontSize: 26, fontWeight: 600, color: BRAND_PRIMARY }}>
            estokei.app.br
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            marginLeft: 'auto',
            alignSelf: 'center',
            width: 380,
            padding: 20,
            borderRadius: 18,
            background: 'rgba(255,255,255,0.9)',
            border: '1px solid #fed7aa',
          }}
        >
          <div style={{ display: 'flex', fontSize: 20, fontWeight: 600 }}>Estoque</div>
          {STOCK.map((item) => (
            <div
              key={item.name}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 14px',
                borderRadius: 10,
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderLeft: `4px solid ${item.ok ? '#16a34a' : BRAND_PRIMARY}`,
                fontSize: 18,
              }}
            >
              <span>{item.name}</span>
              <span style={{ fontWeight: 600, color: item.ok ? '#16a34a' : BRAND_PRIMARY }}>{item.qty}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  )
}
