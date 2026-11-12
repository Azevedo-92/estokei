import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { EstokeiMark } from '@/components/estokei-mark'
import { LEGAL_ADDRESS, LEGAL_CNPJ, LEGAL_COMPANY, LEGAL_EMAIL } from './legal'

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 backdrop-blur bg-background/80 border-b border-border/40">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <EstokeiMark />
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#recursos" className="hover:text-foreground transition-colors">
              Recursos
            </a>
            <a href="#como-funciona" className="hover:text-foreground transition-colors">
              Como funciona
            </a>
            <a href="#precos" className="hover:text-foreground transition-colors">
              Preços
            </a>
            <a href="#duvidas" className="hover:text-foreground transition-colors">
              Dúvidas
            </a>
          </nav>

          <div className="flex items-center gap-2">
            {user ? (
              <Link
                href="/painel"
                className="rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90 transition"
                style={{ background: 'var(--brand)' }}
              >
                Ir ao painel →
              </Link>
            ) : (
              <>
                <Link
                  href="/entrar"
                  className="hidden sm:inline-block px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Entrar
                </Link>
                <Link
                  href="/#precos"
                  className="rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90 transition"
                  style={{ background: 'var(--brand)' }}
                >
                  Ver planos
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border/40 mt-16">
        <div className="mx-auto max-w-6xl px-6 py-10 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 text-muted-foreground text-sm">
            <EstokeiMark />
          </div>
          <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
            <Link href="/privacidade" className="hover:text-foreground hover:underline">
              Política de Privacidade
            </Link>
            <Link href="/termos" className="hover:text-foreground hover:underline">
              Termos de Uso
            </Link>
            <span>© {new Date().getFullYear()} Estokei. Feito no Brasil.</span>
          </div>
        </div>
        {/* Identificação exigida de quem vende pela internet (Decreto 7.962/2013). */}
        <div className="mx-auto max-w-6xl px-6 pb-8 text-xs leading-relaxed text-muted-foreground">
          {LEGAL_COMPANY} · CNPJ {LEGAL_CNPJ} · {LEGAL_ADDRESS} · {LEGAL_EMAIL}
        </div>
      </footer>
    </div>
  )
}
