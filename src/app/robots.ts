import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

// Só o site oficial aparece no Google; o site de testes (preview) fica fora.
// A área logada e as rotas de sistema não interessam à busca.
export default function robots(): MetadataRoute.Robots {
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
    return { rules: { userAgent: '*', disallow: '/' } }
  }
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/cadastrar', '/privacidade', '/termos'],
      disallow: [
        '/api/',
        '/painel',
        '/produtos',
        '/estoque',
        '/fornecedores',
        '/equipe',
        '/configuracoes',
        '/suporte',
        '/plataforma',
        '/aguardando-liberacao',
        '/onboard',
        '/convite',
        '/redefinir-senha',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
