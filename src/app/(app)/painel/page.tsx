import Link from 'next/link'
import { Boxes, ShoppingCart, Wallet, UsersRound, Package, AlertTriangle, Truck } from 'lucide-react'
import { requireOrganization } from '@/lib/auth'
import { SITE_NAME } from '@/lib/site'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Painel' }

// Os módulos que ainda faltam (PDV, financeiro) entram nas próximas etapas e
// passam a alimentar os indicadores desta tela.
const MODULES = [
  { icon: ShoppingCart, title: 'Vendas e PDV', text: 'Venda no balcão, orçamentos em PDF e histórico.' },
  { icon: Wallet, title: 'Financeiro', text: 'Contas a pagar e a receber, fluxo de caixa.' },
]

export default async function PainelPage() {
  const { organization } = await requireOrganization()
  const supabase = await createClient()
  const base = (table: 'products' | 'suppliers') =>
    supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organization.id)
      .eq('active', true)
  const [{ count: products }, { count: low }, { count: suppliers }] = await Promise.all([
    base('products'),
    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organization.id)
      .eq('active', true)
      .eq('low_stock', true),
    base('suppliers'),
  ])
  const STATS = [
    { icon: Package, label: 'Produtos ativos', value: products ?? 0, href: '/produtos' },
    { icon: AlertTriangle, label: 'Com estoque baixo', value: low ?? 0, href: '/produtos?filtro=baixo', alert: (low ?? 0) > 0 },
    { icon: Truck, label: 'Fornecedores', value: suppliers ?? 0, href: '/fornecedores' },
  ]

  return (
    <div className="space-y-8 max-w-4xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Olá, {organization.name}!</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bem-vindo ao {SITE_NAME}. Aqui está o resumo da sua loja.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        {STATS.map(({ icon: Icon, label, value, href, alert }) => (
          <Link key={label} href={href} className="rounded-lg border bg-card p-5 hover:bg-accent/40">
            <Icon className={alert ? 'h-5 w-5 text-rose-600' : 'h-5 w-5'} style={alert ? undefined : { color: 'var(--brand)' }} aria-hidden />
            <p className={alert ? 'mt-3 text-2xl font-semibold tabular-nums text-rose-700' : 'mt-3 text-2xl font-semibold tabular-nums'}>
              {value}
            </p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </Link>
        ))}
      </section>

      {products === 0 ? (
        <section className="rounded-lg border bg-card p-5">
          <div className="flex items-start gap-3">
            <Boxes className="h-5 w-5 shrink-0" style={{ color: 'var(--brand)' }} aria-hidden />
            <div>
              <h2 className="text-sm font-semibold">Cadastre seus produtos</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Comece pelos produtos e pelo estoque atual; cada entrada, perda e ajuste fica registrada.
              </p>
              <Link href="/produtos/novo" className="mt-3 inline-block text-sm font-medium underline underline-offset-4">
                Cadastrar produto
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2">
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
