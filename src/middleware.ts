import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const CANONICAL_HOST = 'estokei.app.br'
const PREVIEW_HOSTS = new Set(['estokei.vercel.app'])

export async function middleware(request: NextRequest) {
  // Redirect 308 pra hostname canônico. Cliente que digita ou tem bookmark do
  // estokei.vercel.app cai automaticamente no domínio próprio, preservando
  // path e query. Não afeta preview deploys (nome tem hash).
  const host = request.headers.get('host') ?? ''
  if (PREVIEW_HOSTS.has(host)) {
    const url = request.nextUrl.clone()
    url.host = CANONICAL_HOST
    url.protocol = 'https:'
    url.port = ''
    return NextResponse.redirect(url, 308)
  }

  return updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - api/webhooks/* (public webhooks)
     * - files with extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\..*).*)',
  ],
}
