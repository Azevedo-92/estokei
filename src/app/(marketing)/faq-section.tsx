import { Plus } from 'lucide-react'

// Respostas descrevem o que o sistema faz hoje — ao mudar uma regra (planos,
// nota fiscal, cancelamento), atualize aqui também.
const FAQ: { q: string; a: string }[] = [
  {
    q: 'Para que tipo de loja o Estokei serve?',
    a: 'Para o comércio com estoque e venda no balcão: materiais de construção, ferragens, elétricas, autopeças, papelarias, lojas de utilidades e similares.',
  },
  {
    q: 'Como faço para contratar?',
    a: 'Crie sua conta, escolha o plano e pague dentro do sistema por Pix, boleto ou cartão. Assim que o pagamento é confirmado, liberamos o acesso da sua equipe. Se preferir conversar antes, use o link do WhatsApp embaixo de cada plano.',
  },
  {
    q: 'O Estokei emite nota fiscal das minhas vendas (NFC-e / NF-e)?',
    a: 'Ainda não. A emissão de nota fiscal de venda está em desenvolvimento. Hoje o sistema cuida do PDV, do estoque, dos orçamentos e do financeiro.',
  },
  {
    q: 'Vocês emitem nota fiscal da assinatura?',
    a: 'Sim. Para cada pagamento da assinatura é emitida nota fiscal de serviço em nome da sua empresa (CNPJ) ou no seu nome (CPF).',
  },
  {
    q: 'Qual a diferença entre os planos?',
    a: 'Só o tamanho da equipe: até 2, 5 ou 15 pessoas. Todos os recursos estão em todos os planos. Para equipes maiores, fale com a gente.',
  },
  {
    q: 'Existe limite de produtos ou clientes?',
    a: 'Não. Em qualquer plano você cadastra quantos produtos e clientes precisar.',
  },
  {
    q: 'Preciso instalar alguma coisa?',
    a: 'Não. O Estokei funciona no navegador, no computador e no celular.',
  },
  {
    q: 'Meus dados ficam seguros?',
    a: 'Os dados ficam em servidores no Brasil (São Paulo), com cópia de segurança diária. Cada loja enxerga apenas os próprios dados.',
  },
  {
    q: 'Posso usar com a marca da minha loja?',
    a: 'Sim. Você coloca o logo e a cor da sua loja, e o sistema passa a usar essa identidade para toda a equipe e nos orçamentos.',
  },
  {
    q: 'Posso cancelar quando quiser?',
    a: 'Sim. Não há fidelidade nem taxa de implantação. No plano anual, devolvemos o valor proporcional aos meses não usados.',
  },
  {
    q: 'Como funciona o suporte?',
    a: 'Dentro do sistema há a página Suporte: você escreve sua dúvida, problema ou sugestão e respondemos no seu e-mail.',
  },
]

export function FaqSection() {
  return (
    <section id="duvidas" className="border-t bg-muted/20">
      <div className="mx-auto max-w-3xl px-6 py-20 md:py-24">
        <div className="text-center">
          <div
            className="text-xs font-medium tracking-wide uppercase"
            style={{ color: 'var(--brand)' }}
          >
            Dúvidas frequentes
          </div>
          <h2 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight">
            Perguntas que sempre recebemos
          </h2>
        </div>

        <div className="mt-10 divide-y rounded-2xl border bg-card">
          {FAQ.map((item) => (
            <details key={item.q} className="group px-5 sm:px-6 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-md">
                <span>{item.q}</span>
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-muted-foreground transition-transform duration-200 group-open:rotate-45 group-open:text-foreground"
                  aria-hidden
                >
                  <Plus className="h-4 w-4" />
                </span>
              </summary>
              <p className="pb-5 pr-11 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
