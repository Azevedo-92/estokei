import Link from 'next/link'
import { Boxes, ShoppingCart, Wallet, UsersRound } from 'lucide-react'
import { requireOrganization } from '@/lib/auth'
import { SITE_NAME } from '@/lib/site'

export const metadata = { title: 'Painel' }

// Painel provisório: os módulos da loja (estoque, PDV, financeiro) entram nas
// próximas etapas e passam a alimentar os indicadores desta tela.
const MODULES = [
  { icon: Boxes, title: 'Estoque', text: 'Produtos, entradas, saídas e alerta de estoque baixo.' },
  { icon: ShoppingCart, title: 'Vendas e PDV', text: 'Venda no balcão, orçamentos em PDF e histórico.' },
  { icon: Wallet, title: 'Financeiro', text: 'Contas a pagar e a receber, fluxo de caixa.' },
]

export default async function PainelPage() {
  const { organization } = await requireOrganization()

  return (
    <div className="space-y-8 max-w-4xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Olá, {organization.name}!</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bem-vindo ao {SITE_NAME}. Os módulos da sua loja estão chegando.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        {MODULES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-lg border bg-card p-5">
            <Icon className="h-5 w-5" style={{ color: 'var(--brand)' }} aria-hidden />
            <h2 className="mt-3 text-sm font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            <span className="mt-3 inline-block rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              Em breve
            </span>
          </div>
        ))}
      </section>

      <section className="rounded-lg border bg-card p-5">
        <div className="flex items-start gap-3">
          <UsersRound className="h-5 w-5 shrink-0" style={{ color: 'var(--brand)' }} aria-hidden />
          <div>
            <h2 className="text-sm font-semibold">Monte sua equipe</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Convide caixas, vendedores e administradores para usar o sistema com você.
            </p>
            <Link href="/equipe" className="mt-3 inline-block text-sm font-medium underline underline-offset-4">
              Ir para Equipe
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
