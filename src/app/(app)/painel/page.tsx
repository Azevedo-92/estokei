import Link from 'next/link'
import { Boxes, ShoppingCart, Wallet, UsersRound, Package, AlertTriangle, Users, FileText, Receipt } from 'lucide-react'
import { requireOrganization } from '@/lib/auth'
import { SITE_NAME } from '@/lib/site'
import { createClient } from '@/lib/supabase/server'
import { formatCurrencyBRL } from '@/lib/utils'
import { salesSummary, startOfDaySP } from '../vendas/sales-summary'

export const metadata = { title: 'Painel' }

// Os módulos que ainda faltam (orçamentos, financeiro) entram nas próximas
// etapas e passam a alimentar os indicadores desta tela.
const MODULES = [
  { icon: FileText, title: 'Orçamentos', text: 'Orçamento em PDF com a sua marca, que vira venda com um clique.' },
  { icon: Wallet, title: 'Financeiro', text: 'Contas a pagar e a receber, fluxo de caixa.' },
]

export default async function PainelPage() {
  const { organization } = await requireOrganization()
  const supabase = await createClient()
  const base = (table: 'products' | 'customers') =>
    supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organization.id)
      .eq('active', true)
  const [{ count: products }, { count: low }, { count: customers }, today] = await Promise.all([
    base('products'),
    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organization.id)
      .eq('active', true)
      .eq('low_stock', true),
    base('customers'),
    salesSummary(supabase, organization.id, startOfDaySP(0)),
  ])
  const STATS = [
    { icon: Receipt, label: `Vendido hoje (${today.count} venda${today.count === 1 ? '' : 's'})`, value: formatCurrencyBRL(today.total), href: '/vendas' },
    { icon: Package, label: 'Produtos ativos', value: products ?? 0, href: '/produtos' },
    { icon: AlertTriangle, label: 'Com estoque baixo', value: low ?? 0, href: '/produtos?filtro=baixo', alert: (low ?? 0) > 0 },
    { icon: Users, label: 'Clientes', value: customers ?? 0, href: '/clientes' },
  ]

  return (
    <div className="space-y-8 max-w-4xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Olá, {organization.name}!</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bem-vindo ao {SITE_NAME}. Aqui está o resumo da sua loja.
        </p>
      </header>

      <Link
        href="/pdv"
        className="flex items-center justify-between gap-4 rounded-lg border bg-primary p-5 text-primary-foreground hover:bg-primary/90"
      >
        <span className="flex items-center gap-3">
          <ShoppingCart className="h-6 w-6" aria-hidden />
          <span>
            <span className="block text-lg font-semibold">Abrir o PDV</span>
            <span className="block text-sm opacity-90">Venda no balcão com baixa automática no estoque</span>
          </span>
        </span>
        <span aria-hidden className="text-2xl">→</span>
      </Link>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
