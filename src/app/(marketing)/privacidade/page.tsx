import {
  LEGAL_ADDRESS,
  LEGAL_CNPJ,
  LEGAL_COMPANY,
  LEGAL_DPO,
  LEGAL_EMAIL,
  LegalPage,
  List,
  Section,
  Strong,
} from '../legal'

export const metadata = {
  title: 'Política de Privacidade',
  description: 'Como o Estokei coleta, usa, guarda e protege dados pessoais, conforme a LGPD.',
}

// Mantenha esta página de acordo com o que o sistema realmente faz (fornecedores,
// prazos de guarda, cookies). Mudou algo? Atualize aqui e a data em legal.tsx.
export default function PrivacidadePage() {
  return (
    <LegalPage
      title="Política de Privacidade"
      intro={
        <p>
          Esta política explica como o Estokei trata dados pessoais, em linguagem simples e de
          acordo com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD). Ela vale para o
          site estokei.app.br e para o sistema Estokei.
        </p>
      }
    >
      <Section n={1} title="Quem é o responsável">
        <p>
          O Estokei é mantido pela <Strong>{LEGAL_COMPANY}</Strong>, inscrita no CNPJ sob o
          nº {LEGAL_CNPJ}, com sede na {LEGAL_ADDRESS}. Para qualquer assunto sobre privacidade e
          dados pessoais, fale pelo e-mail <Strong>{LEGAL_EMAIL}</Strong>.
        </p>
      </Section>

      <Section n={2} title="Dois papéis diferentes">
        <List
          items={[
            <>
              <Strong>Dados de quem usa o sistema</Strong> (nome e e-mail das pessoas das empresas
              clientes): aqui o Estokei é o <Strong>controlador</Strong>, ou seja, decide como
              esses dados são usados.
            </>,
            <>
              <Strong>Dados que as empresas cadastram sobre os clientes delas</Strong> (por exemplo,
              os clientes e fornecedores de uma loja): a empresa que usa o Estokei é a{' '}
              <Strong>controladora</Strong> e o Estokei é o <Strong>operador</Strong> — só trata
              esses dados para prestar o serviço, conforme as instruções da empresa.
            </>,
          ]}
        />
      </Section>

      <Section n={3} title="Quais dados tratamos">
        <List
          items={[
            <>
              <Strong>Conta:</Strong> nome, e-mail e senha. A senha é guardada de forma
              criptografada e ninguém consegue lê-la.
            </>,
            <>
              <Strong>Empresa:</Strong> nome, logo e cor escolhidos pela empresa.
            </>,
            <>
              <Strong>Cobrança:</Strong> nome ou razão social, CPF ou CNPJ e e-mail informados para
              a assinatura, o plano escolhido e a situação de cada cobrança. Os dados do cartão de
              crédito são digitados direto na página do Asaas — o Estokei não os recebe nem
              guarda.
            </>,
            <>
              <Strong>Dados cadastrados pela empresa:</Strong> nome, CPF ou CNPJ, telefone, e-mail e
              endereço dos clientes e fornecedores dela, produtos e estoque, vendas, orçamentos e
              lançamentos financeiros.
            </>,
            <>
              <Strong>Suporte:</Strong> o texto das mensagens enviadas pela página de suporte.
            </>,
            <>
              <Strong>Registros técnicos:</Strong> registros de acesso mantidos pelos provedores de
              hospedagem, necessários para segurança.
            </>,
          ]}
        />
      </Section>

      <Section n={4} title="Para que usamos os dados">
        <List
          items={[
            <>
              <Strong>Prestar o serviço contratado</Strong>: login, PDV, estoque, orçamentos,
              financeiro e os e-mails do sistema (execução de contrato — art. 7º, V, da LGPD).
            </>,
            <>
              <Strong>Atender pedidos de suporte</Strong> (execução de contrato).
            </>,
            <>
              <Strong>Cobrar a assinatura e emitir nota fiscal</Strong> (execução de contrato e
              obrigação legal).
            </>,
            <>
              <Strong>Segurança e prevenção de fraudes</Strong>, como monitorar erros e acessos
              indevidos (legítimo interesse — art. 7º, IX).
            </>,
            <>
              <Strong>Cumprir obrigações legais</Strong> e atender autoridades quando exigido por lei
              (art. 7º, II).
            </>,
          ]}
        />
        <p>
          Não vendemos dados pessoais e não usamos os dados cadastrados pelas empresas para
          publicidade.
        </p>
      </Section>

      <Section n={5} title="Com quem compartilhamos">
        <p>Usamos fornecedores que tratam dados somente para nos ajudar a prestar o serviço:</p>
        <List
          items={[
            <>
              <Strong>Supabase</Strong> — banco de dados e login, com servidores em São Paulo
              (Brasil).
            </>,
            <>
              <Strong>Vercel</Strong> — hospedagem do site e do sistema, com servidores em São Paulo
              (empresa sediada nos Estados Unidos), e medição de visitas às páginas públicas, sem
              cookies.
            </>,
            <>
              <Strong>Resend</Strong> — envio dos e-mails do sistema (Estados Unidos).
            </>,
            <>
              <Strong>Sentry</Strong> — monitoramento de erros (Estados Unidos), configurado para{' '}
              <Strong>não</Strong> receber nomes, e-mails ou endereços de IP.
            </>,
            <>
              <Strong>Cloudflare</Strong> — gerenciamento do domínio e encaminhamento de e-mails
              recebidos.
            </>,
            <>
              <Strong>Asaas</Strong> — cobrança da assinatura (Pix, boleto e cartão), no Brasil.
              Recebe os dados de cobrança da empresa contratante.
            </>,
          ]}
        />
      </Section>

      <Section n={6} title="Transferência para fora do Brasil">
        <p>
          Os dados ficam armazenados no Brasil, mas alguns fornecedores acima são sediados ou
          processam informações fora do país (por exemplo, para enviar um e-mail). Nesses casos, a
          transferência é feita para prestar o serviço contratado e com fornecedores que adotam
          padrões de proteção de dados compatíveis com a LGPD (art. 33).
        </p>
      </Section>

      <Section n={7} title="Por quanto tempo guardamos">
        <List
          items={[
            'Dados da conta e da empresa: enquanto a assinatura estiver ativa.',
            'Após o cancelamento: excluídos em até 90 dias, salvo obrigação legal de guarda.',
            'Dados de cobrança e notas fiscais: pelo prazo exigido pela legislação fiscal (em geral, 5 anos).',
            'Mensagens de suporte: 24 meses.',
            'Cópias de segurança (backup): até 7 dias.',
          ]}
        />
      </Section>

      <Section n={8} title="Como protegemos os dados">
        <List
          items={[
            'Comunicação sempre criptografada (HTTPS).',
            'Senhas guardadas de forma criptografada.',
            'Isolamento entre empresas no próprio banco de dados: cada empresa só acessa os próprios dados.',
            'Permissões por papel (dono, administrador e membro) dentro de cada empresa.',
            'Cópias de segurança diárias e acesso técnico restrito.',
          ]}
        />
      </Section>

      <Section n={9} title="Cookies">
        <p>
          Usamos apenas <Strong>cookies essenciais</Strong>: para manter você conectado e para
          lembrar qual empresa você escolheu, se participar de mais de uma. Não usamos cookies de
          publicidade nem de rastreamento.
        </p>
        <p>
          Para saber quantas pessoas visitam as páginas públicas do site (início, cadastro e
          textos legais) e de onde vieram, usamos a medição de visitas da <Strong>Vercel</Strong>,
          que funciona <Strong>sem cookies</Strong> e não identifica quem visita. A área logada do
          sistema não é medida.
        </p>
      </Section>

      <Section n={10} title="Seus direitos">
        <p>Pela LGPD (art. 18), você pode pedir, a qualquer momento:</p>
        <List
          items={[
            'confirmação de que tratamos seus dados e acesso a eles;',
            'correção de dados incompletos, inexatos ou desatualizados;',
            'anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade;',
            'portabilidade dos dados;',
            'informação sobre com quem compartilhamos seus dados;',
            'eliminação dos dados, quando aplicável, e revisão de decisões.',
          ]}
        />
        <p>
          Para isso, escreva para <Strong>{LEGAL_EMAIL}</Strong>. Respondemos em até 15 dias. Se você
          é cliente de uma empresa que usa o Estokei, o pedido deve ser feito primeiro a essa
          empresa, que é a controladora dos seus dados — nós a ajudamos a atender. As empresas
          também podem exportar os próprios clientes a qualquer momento, pelo sistema.
        </p>
      </Section>

      <Section n={11} title="Incidentes de segurança">
        <p>
          Se acontecer um incidente de segurança que possa causar risco ou dano relevante,
          comunicaremos a Autoridade Nacional de Proteção de Dados (ANPD) e as pessoas afetadas,
          como determina a lei.
        </p>
      </Section>

      <Section n={12} title="Encarregado de dados">
        <p>
          O encarregado pelo tratamento de dados pessoais é <Strong>{LEGAL_DPO}</Strong>, pelo
          e-mail <Strong>{LEGAL_EMAIL}</Strong>.
        </p>
      </Section>

      <Section n={13} title="Mudanças nesta política">
        <p>
          Podemos atualizar esta política. A versão em vigor fica sempre nesta página, com a data da
          última atualização. Mudanças relevantes serão avisadas por e-mail aos responsáveis pelas
          empresas.
        </p>
      </Section>
    </LegalPage>
  )
}
