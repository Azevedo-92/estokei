import type { MetadataRoute } from 'next'

/**
 * Manifest do PWA. Ao adicionar estokei.app.br à tela de início do
 * celular:
 * - Android/Chrome usa /icon.svg (aceita SVG desde Chrome 79)
 * - iOS/Safari usa /apple-icon (PNG gerado em app/apple-icon.tsx)
 * - theme_color pinta a barra do sistema e o splash de abertura
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Estokei',
    short_name: 'Estokei',
    description:
      'PDV, controle de estoque, orçamentos e financeiro para o seu comércio.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#ea580c',
    lang: 'pt-BR',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
