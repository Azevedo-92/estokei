import Link from 'next/link'

// Estrutura comum da Política de Privacidade e dos Termos de Uso.

/** Empresa responsável pelo Estokei (dados do CNPJ). */
export const LEGAL_COMPANY = 'Client Cycle Consultoria em TI Ltda.'
export const LEGAL_CNPJ = '69.708.864/0001-69'
export const LEGAL_ADDRESS = 'Rua Pais Leme, 215, conj. 1713, Pinheiros, São Paulo/SP, CEP 05424-150'
/** Encarregado de dados (LGPD, art. 41) — pessoa, não a empresa. */
export const LEGAL_DPO = 'Ricardo Manoel Peixoto Azevedo Filho'
export const LEGAL_EMAIL = 'contato@clientcycle.com.br'
export const LEGAL_UPDATED = '12 de novembro de 2026'
/** Versão gravada no aceite do cadastro. Mude junto com LEGAL_UPDATED. */
export const TERMS_VERSION = '2026-11-12'

export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string
  intro: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <article className="mx-auto max-w-3xl px-6 py-14 md:py-20">
      <div className="text-xs font-medium tracking-wide uppercase" style={{ color: 'var(--brand)' }}>
        Estokei
      </div>
      <h1 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Última atualização: {LEGAL_UPDATED}</p>
      <div className="mt-6 text-[15px] leading-relaxed text-muted-foreground">{intro}</div>
      <div className="mt-10 space-y-10">{children}</div>
      <p className="mt-14 border-t pt-6 text-sm text-muted-foreground">
        Veja também:{' '}
        <Link href="/privacidade" className="underline hover:text-foreground">
          Política de Privacidade
        </Link>{' '}
        ·{' '}
        <Link href="/termos" className="underline hover:text-foreground">
          Termos de Uso
        </Link>
      </p>
    </article>
  )
}

export function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">
        {n}. {title}
      </h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-muted-foreground">{children}</div>
    </section>
  )
}

export function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  )
}

export function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="font-medium text-foreground">{children}</strong>
}
