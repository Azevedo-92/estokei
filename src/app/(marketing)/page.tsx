import Link from 'next/link'
import {
  ArrowRight,
  Boxes,
  Check,
  FileText,
  ShoppingCart,
  Users,
  Wallet,
  Palette,
} from 'lucide-react'
import { SITE_NAME, SITE_TITLE } from '@/lib/site'
import { CompactPlans, PricingSection } from './pricing-section'
import { FaqSection } from './faq-section'

export const metadata = {
  title: SITE_TITLE,
  description:
    'PDV, controle de estoque, orçamentos em PDF e financeiro no navegador. Feito para o comércio com balcão: materiais de construção, ferragens, autopeças, papelarias e lojas em geral.',
}

export default function LandingPage() {
  return (
    <>
      <Hero />
      <TrustStrip />
      <Features />
      <HowItWorks />
      <PricingSection />
      <FaqSection />
      <FinalCta />
    </>
  )
}

function Hero() {
  return (
    <section
      className="relative overflow-hidden"
      style={{
        background:
          'radial-gradient(1200px 600px at 100% -10%, rgba(234,88,12,0.10), transparent 60%), radial-gradient(900px 500px at -10% 110%, rgba(251,146,60,0.12), transparent 55%)',
      }}
    >
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-28 grid gap-12 lg:grid-cols-2 items-center">
        <div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
            Vendeu?{' '}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: 'linear-gradient(90deg, var(--brand) 0%, #f59e0b 100%)',
              }}
            >
              {SITE_NAME}
            </span>
            .<br />
            Estoque certo, caixa no controle.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-lg leading-relaxed">
            {SITE_NAME} é o sistema para o comércio com balcão: <strong className="text-foreground">venda rápida no PDV</strong>,{' '}
            <strong className="text-foreground">estoque que se atualiza sozinho</strong>, orçamentos em PDF com a sua marca e
            contas a pagar e a receber. Tudo no navegador, sem instalar nada.
          </p>

          <div className="mt-8 flex items-center gap-3 flex-wrap">
            <a
              href="#precos"
              className="inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-medium text-white shadow-lg transition-transform hover:scale-[1.02]"
              style={{ background: 'var(--brand)' }}
            >
              Ver planos
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#recursos"
              className="inline-flex items-center gap-2 rounded-lg border px-5 py-3 text-sm font-medium hover:bg-accent transition"
            >
              Ver recursos
            </a>
          </div>

          <div className="mt-6 flex items-center gap-6 text-xs text-muted-foreground flex-wrap">
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-500" />
              Sem taxa de implantação
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-500" />
              Funciona no computador e no celular
            </span>
          </div>
        </div>

        <div className="lg:justify-self-end w-full">
          <PdvMockup />
        </div>
      </div>
    </section>
  )
}

function PdvMockup() {
  const items = [
    { name: 'Cimento CP II 50 kg', qty: 10, price: 39.9 },
    { name: 'Argamassa AC-I 20 kg', qty: 6, price: 18.5 },
    { name: 'Tinta acrílica 18 L', qty: 1, price: 289.0 },
  ]
  const total = items.reduce((sum, i) => sum + i.qty * i.price, 0)
  const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-6 rounded-3xl blur-3xl opacity-30"
        style={{ background: 'linear-gradient(135deg, var(--brand), #f59e0b)' }}
      />
      <div className="relative rounded-2xl border bg-card shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center gap-2 bg-muted/30">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          <span className="ml-2 text-xs text-muted-foreground truncate">estokei.app.br/pdv</span>
        </div>
        <div className="p-4 space-y-2">
          {items.map((i) => (
            <div key={i.name} className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-xs shadow-sm">
              <span className="font-medium truncate">{i.name}</span>
              <span className="text-muted-foreground tabular-nums">
                {i.qty} × {brl(i.price)}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between border-t pt-3 mt-3">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-lg font-semibold tabular-nums">{brl(total)}</span>
          </div>
          <div
            className="rounded-md py-2 text-center text-sm font-medium text-white"
            style={{ background: 'var(--brand)' }}
          >
            Finalizar venda
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
            Estoque baixo: Tinta acrílica 18 L — restam 5 unidades
          </div>
        </div>
      </div>
    </div>
  )
}

function TrustStrip() {
  return (
    <section className="border-y bg-muted/20">
      <div className="mx-auto max-w-6xl px-6 py-8 grid gap-6 sm:grid-cols-3 text-center">
        <Stat label="Para começar a vender" value="Minutos" />
        <Stat label="Instalação" value="Nenhuma" />
        <Stat label="Suporte" value="Em português" />
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  )
}

function Features() {
  return (
    <section id="recursos" className="mx-auto max-w-6xl px-6 py-20 md:py-24">
      <div className="max-w-2xl">
        <div className="text-xs font-medium tracking-wide uppercase" style={{ color: 'var(--brand)' }}>
          Recursos
        </div>
        <h2 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight">
          O que a loja precisa no dia a dia. Nada que atrapalhe.
        </h2>
        <p className="mt-4 text-muted-foreground">
          Sem módulos que ninguém usa nem implantação demorada. Você cadastra os produtos,
          abre o caixa e começa a vender.
        </p>
      </div>

      <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <FeatureCard
          icon={ShoppingCart}
          title="PDV no balcão"
          desc="Busca por nome ou código de barras, desconto, cliente e forma de pagamento. A venda baixa o estoque na hora."
        />
        <FeatureCard
          icon={Boxes}
          title="Controle de estoque"
          desc="Entradas com nota do fornecedor, perdas e ajustes. Aviso quando um produto chega no estoque mínimo."
        />
        <FeatureCard
          icon={FileText}
          title="Orçamentos em PDF"
          desc="Monte o orçamento, envie em PDF com o logo da sua loja e transforme em venda com um clique."
        />
        <FeatureCard
          icon={Wallet}
          title="Financeiro"
          desc="Contas a pagar e a receber, vencimentos da semana e visão do caixa no painel."
        />
        <FeatureCard
          icon={Users}
          title="Equipe com permissões"
          desc="Dono, caixa e vendedor: cada um vê só o que precisa. Os dados de cada loja ficam isolados."
        />
        <FeatureCard
          icon={Palette}
          title="Sua marca no sistema"
          desc="Logo e cor da sua loja no sistema e nos documentos que você entrega ao cliente."
        />
      </div>
    </section>
  )
}

function FeatureCard({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  desc: string
}) {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm hover:shadow-md transition-shadow">
      <div
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg"
        style={{
          background: 'color-mix(in oklab, var(--brand) 12%, white)',
          color: 'var(--brand)',
        }}
      >
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  )
}

function HowItWorks() {
  return (
    <section id="como-funciona" className="border-t bg-muted/20">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-24">
        <div className="max-w-2xl">
          <div
            className="text-xs font-medium tracking-wide uppercase"
            style={{ color: 'var(--brand)' }}
          >
            Como funciona
          </div>
          <h2 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight">
            Em 3 passos você já está usando.
          </h2>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <Step
            n="01"
            title="Contrata o plano"
            desc="Escolhe o plano pelo tamanho da equipe, cria a conta e paga por Pix, boleto ou cartão. Liberamos o acesso e sua equipe já entra."
          />
          <Step
            n="02"
            title="Cadastra os produtos"
            desc="Produtos com código, preço e estoque mínimo. Clientes e fornecedores no mesmo lugar."
          />
          <Step
            n="03"
            title="Começa a vender"
            desc="Abre o PDV e vende. Estoque, histórico de vendas e financeiro se atualizam sozinhos."
          />
        </div>
      </div>
    </section>
  )
}

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="rounded-xl border bg-card p-6 relative">
      <div
        className="text-5xl font-semibold tracking-tighter opacity-20"
        style={{ color: 'var(--brand)' }}
      >
        {n}
      </div>
      <h3 className="mt-2 text-base font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  )
}

function FinalCta() {
  return (
    <section className="border-t">
      <div className="mx-auto max-w-4xl px-6 py-20 md:py-24 text-center">
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
          Pronto para colocar a loja em ordem?
        </h2>
        <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
          Escolha o plano pelo tamanho da equipe. Sem taxa de implantação, sem fidelidade.
        </p>
        <div className="mt-10">
          <CompactPlans />
        </div>
        <p className="mt-8 text-sm text-muted-foreground">
          Já é cliente?{' '}
          <Link href="/entrar" className="font-medium text-foreground hover:underline">
            Entrar na sua conta
          </Link>
        </p>
      </div>
    </section>
  )
}
