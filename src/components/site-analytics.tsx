'use client'

import { Analytics } from '@vercel/analytics/next'

// Contagem de visitas (Vercel Web Analytics): sem cookies e sem identificar a
// pessoa. Só conta as páginas públicas — a área logada fica de fora, para não
// registrar endereços com ids de clientes. Descrito na Política de Privacidade.
const PUBLIC_PATHS = ['/', '/cadastrar', '/entrar', '/privacidade', '/termos']

export function SiteAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => {
        const path = new URL(event.url).pathname
        return PUBLIC_PATHS.includes(path) ? event : null
      }}
    />
  )
}
