import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/lib/supabase/database.types'
import { sanitizeEnv } from '@/lib/supabase/env'

const PUBLIC_ROUTES = [
  '/entrar',
  '/cadastrar',
  '/redefinir-senha',
  '/auth/callback',
  '/convite',
  '/privacidade',
  '/termos',
]
const PUBLIC_EXACT = new Set([
  '/',
  '/apple-icon',
  '/icon',
  '/manifest.webmanifest',
  // Imagem de prévia dos links (app/opengraph-image.tsx).
  '/opengraph-image',
])

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    sanitizeEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL'),
    sanitizeEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isPublic =
    PUBLIC_EXACT.has(path) || PUBLIC_ROUTES.some((route) => path.startsWith(route))

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/entrar'
    url.searchParams.set('proximo', path)
    return NextResponse.redirect(url)
  }

  if (user && (path === '/entrar' || path === '/cadastrar')) {
    const url = request.nextUrl.clone()
    // Já logado e vindo de um convite: volta para o convite, não para o painel.
    const convite = request.nextUrl.searchParams.get('convite')
    // Já logado e vindo do botão "Contratar" da página de preços: vai para a
    // tela do plano, mantendo o plano e o ciclo escolhidos.
    const plano = request.nextUrl.searchParams.get('plano')
    const ciclo = request.nextUrl.searchParams.get('ciclo')
    url.pathname = convite
      ? `/convite/${encodeURIComponent(convite)}`
      : plano
        ? '/configuracoes/plano'
        : '/painel'
    url.search = ''
    if (!convite && plano) {
      url.searchParams.set('plano', plano)
      if (ciclo) url.searchParams.set('ciclo', ciclo)
    }
    return NextResponse.redirect(url)
  }

  return response
}
