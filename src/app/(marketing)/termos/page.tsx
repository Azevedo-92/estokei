import Link from 'next/link'
import { LEGAL_ADDRESS, LEGAL_CNPJ, LEGAL_COMPANY, LEGAL_EMAIL, LegalPage, List, Section, Strong } from '../legal'

export const metadata = {
  title: 'Termos de Uso',
  description: 'Regras de uso, contratação, cancelamento e responsabilidades do Estokei.',
}

// Mantenha de acordo com a página de preços (planos, anual = 10 mensalidades,
// cancelamento) e com o funcionamento real do sistema.
export default function TermosPage() {
  return (
    <LegalPage
      title="Termos de Uso"
      intro={
        <p>
          Estes termos regulam o uso do Estokei, sistema online mantido pela{' '}
          <Strong>{LEGAL_COMPANY}</Strong>, inscrita no CNPJ sob o nº {LEGAL_CNPJ}, com sede na{' '}
          {LEGAL_ADDRESS} (&quot;Estokei&quot;, &quot;nós&quot;). Ao criar uma
          conta ou usar o sistema, você e a empresa que você representa (&quot;Cliente&quot;)
          concordam com estes termos e com a{' '}
          <Link href="/privacidade" className="underline hover:text-foreground">
            Política de Privacidade
          </Link>
          .
        </p>
      }
    >
      <Section n={1} title="O serviço">
        <p>
          O Estokei é um sistema de gestão para o comércio: ponto de venda (PDV), controle de
          estoque, cadastro de produtos, clientes e fornecedores, orçamentos e controle financeiro
          (contas a pagar e a receber). O Estokei <Strong>não emite nota fiscal de venda</Strong>{' '}
          (NFC-e ou NF-e) enquanto esse recurso não for oferecido expressamente na página de preços.
        </p>
      </Section>

      <Section n={2} title="Conta e acesso">
        <List
          items={[
            'Os dados informados no cadastro devem ser verdadeiros e mantidos atualizados.',
            'Cada pessoa é responsável por manter sua senha em sigilo e pelo que for feito com sua conta.',
            'O dono e os administradores de cada empresa decidem quem entra na equipe, os papéis de cada pessoa e respondem pelo uso feito por ela.',
            'Empresas novas ficam aguardando liberação até a contratação de um plano e a conferência pela nossa equipe.',
          ]}
        />
      </Section>

      <Section n={3} title="Planos e pagamento">
        <List
          items={[
            <>
              Os planos variam conforme o número de pessoas da equipe; os preços em vigor estão na{' '}
              <Link href="/#precos" className="underline hover:text-foreground">
                página de preços
              </Link>
              .
            </>,
            'A cobrança é mensal ou anual, paga antecipadamente. No plano anual, o Cliente paga o equivalente a 10 mensalidades.',
            'O pagamento é feito dentro do sistema, por Pix, boleto ou cartão de crédito, processado pelo Asaas. Para cada pagamento é emitida nota fiscal de serviço.',
            'A assinatura se renova automaticamente a cada período até ser cancelada.',
            'O número de pessoas na equipe é limitado ao do plano contratado.',
            'Não há taxa de implantação nem fidelidade.',
            'Os preços podem ser reajustados com aviso de pelo menos 30 dias, valendo a partir do período seguinte.',
            'Se uma cobrança continuar em aberto 10 dias depois do vencimento, o acesso é suspenso automaticamente; antes disso, o sistema avisa o dono e os administradores. Os dados continuam guardados e o acesso volta sozinho assim que o pagamento é confirmado.',
          ]}
        />
      </Section>

      <Section n={4} title="Cancelamento e reembolso">
        <List
          items={[
            'O Cliente pode cancelar a qualquer momento, sem multa, pelo e-mail ' + LEGAL_EMAIL + ' ou pelo WhatsApp comercial.',
            'Plano mensal: o acesso continua até o fim do período já pago, sem reembolso proporcional.',
            'Plano anual: devolvemos o valor proporcional aos meses inteiros ainda não usados.',
            'Antes de cancelar, o Cliente pode pedir pelo Suporte uma cópia dos seus dados (produtos, clientes, vendas e lançamentos financeiros). Após o cancelamento, os dados são excluídos em até 90 dias, salvo obrigação legal de guarda.',
          ]}
        />
      </Section>

      <Section n={5} title="Dados cadastrados pelo Cliente">
        <List
          items={[
            'Os dados que o Cliente cadastra (inclusive os dos clientes e fornecedores dele) pertencem ao Cliente, que é o controlador desses dados pela LGPD. O Estokei atua como operador, tratando-os apenas para prestar o serviço.',
            'O Cliente é responsável por ter base legal para cadastrar esses dados.',
            'O Cliente pode pedir uma cópia dos seus dados a qualquer momento pelo Suporte.',
          ]}
        />
      </Section>

      <Section n={6} title="Uso permitido">
        <p>Não é permitido usar o Estokei para:</p>
        <List
          items={[
            'atividades ilegais ou envio de mensagens não solicitadas (spam);',
            'tentar acessar dados de outras empresas, burlar a segurança ou as permissões do sistema;',
            'copiar, revender ou fazer engenharia reversa do sistema;',
            'sobrecarregar o serviço de forma intencional.',
          ]}
        />
        <p>O descumprimento pode levar à suspensão do acesso.</p>
      </Section>

      <Section n={7} title="Obrigações fiscais e conferência dos números">
        <p>
          O Estokei ajuda a organizar vendas, estoque e finanças, mas os números dependem do que é
          cadastrado e lançado pela equipe do Cliente.
          <Strong>
            {' '}
            O Cliente continua responsável pelas suas obrigações fiscais, contábeis e tributárias
          </Strong>{' '}
          — entre elas a emissão de nota fiscal das vendas e a conferência periódica do estoque e do
          caixa. O Estokei não se responsabiliza por prejuízos causados por dados lançados de forma
          incorreta.
        </p>
      </Section>

      <Section n={8} title="Disponibilidade e suporte">
        <p>
          Trabalhamos para manter o sistema disponível e seguro, mas não garantimos funcionamento
          ininterrupto: podem ocorrer manutenções e falhas de fornecedores. O suporte é feito pela
          página Suporte do sistema e pelo e-mail {LEGAL_EMAIL}, em dias úteis.
        </p>
      </Section>

      <Section n={9} title="Limite de responsabilidade">
        <p>
          Na medida permitida pela lei, a responsabilidade do Estokei por qualquer dano fica
          limitada ao valor pago pelo Cliente nos 12 meses anteriores ao fato.
        </p>
      </Section>

      <Section n={10} title="Propriedade intelectual">
        <p>
          O sistema, a marca Estokei e seu conteúdo pertencem à {LEGAL_COMPANY}. O Cliente recebe o
          direito de uso enquanto a assinatura estiver ativa.
        </p>
      </Section>

      <Section n={11} title="Mudanças nos termos">
        <p>
          Podemos atualizar estes termos. A versão em vigor fica nesta página. Mudanças relevantes
          serão avisadas por e-mail com pelo menos 30 dias de antecedência.
        </p>
      </Section>

      <Section n={12} title="Lei aplicável e foro">
        <p>
          Estes termos seguem as leis do Brasil. Fica eleito o foro do domicílio do Cliente para
          resolver qualquer questão sobre eles.
        </p>
      </Section>
    </LegalPage>
  )
}
