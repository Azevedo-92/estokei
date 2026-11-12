@AGENTS.md

# Estokei

SaaS de gestão para comércio com estoque e balcão (materiais de construção,
ferragens, autopeças, papelarias…): PDV, estoque, orçamentos em PDF e
financeiro (contas a pagar e a receber).

Multi-tenant. Nasceu da base SaaS do **ClientCycle** (mesma estrutura de
empresas, equipe, convites, cobrança, plataforma e textos legais); o
ClientCycle é outro produto e outro repositório, que **não** deve ser
alterado a partir daqui. Mantido pela Client Cycle Consultoria em TI Ltda.
(CNPJ e endereço em `src/app/(marketing)/legal.tsx`). Sem teste grátis;
assinatura cobrada pelo Asaas (veja "Cobrança"). A primeira liberação de cada
empresa é manual, em `/plataforma`.

**Estado atual:** só a fundação SaaS está pronta. Os módulos da loja
(produtos, estoque, PDV, orçamentos, financeiro) entram nas próximas etapas;
o `/painel` é provisório. **O Estokei ainda não emite nota fiscal de venda**
(NFC-e/NF-e) — não prometa isso em texto nenhum até existir.

- Produção: https://estokei.app.br (Vercel) — domínio a registrar/apontar
- Repositório: github.com/Azevedo-92/estokei
- Nome do produto centralizado em `SITE_NAME` (`src/lib/site.ts`)
- Idioma do produto e do código: **português**. Rotas, labels e comentários em
  pt-BR; nomes de tabelas e colunas em inglês.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind · Supabase (Auth + Postgres +
Storage) · Resend (e-mail) · Vercel (hospedagem + cron).

## Comandos

```bash
npm run dev        # desenvolvimento
npm run build      # build de produção — use para validar antes de commitar
npm run lint       # eslint
npx tsc --noEmit   # checagem de tipos (ainda não tem script próprio)
npm test           # testes (Vitest) — regras puras de src/lib
```

Os testes (`src/**/*.test.ts`) cobrem as regras puras: datas e fuso
(`utils`), planos e situação da cobrança (`billing`), nota fiscal da assinatura
(`nfse`) e permissão da plataforma (`platform`).
Rodam com fuso de Nova York de propósito — a regra tem que valer em qualquer
fuso. A esteira de deploy roda `npm test` antes das migrations. Mexeu numa regra
dessas? Ajuste ou crie o teste junto. Permissões (RLS) não estão nos testes
automáticos: valide no banco de testes com transação desfeita no final.

---

# Regras de segurança (leia antes de escrever qualquer código)

Estas não são preferências. Quebrar qualquer uma delas expõe dado de cliente.

## 1. Todo dado é isolado por organização via RLS

Toda tabela de negócio tem `organization_id` e RLS ligado. As políticas usam a
função `public.user_organization_ids()`, que devolve as orgs do `auth.uid()` atual.

Ao criar uma tabela nova, ela **precisa** vir com:

```sql
alter table public.nova_tabela enable row level security;

create policy "org_isolation_select" on public.nova_tabela
  for select using (organization_id in (select public.user_organization_ids()));
-- idem para insert (with check), update e delete
```

Nunca escreva `using (true)` ou `with check (true)`. Hoje não existe nenhuma
política assim no projeto — mantenha assim.

## 2. `createServiceClient()` ignora o RLS

Em `src/lib/supabase/server.ts` existem dois clientes:

- `createClient()` — respeita o RLS. **É o padrão.** Use em toda página e action.
- `createServiceClient()` — usa a `SUPABASE_SERVICE_ROLE_KEY` e enxerga tudo de
  todas as organizações.

`createServiceClient()` só é aceitável em rotas de sistema sem usuário logado
(o cron diário) e nas exceções documentadas abaixo. Se for usar, filtre
`organization_id` manualmente — não há rede de proteção. Nunca o importe em
Client Component.

Exceções (cada uma confere a permissão antes de usar o service role):

- `/plataforma` e `src/app/plataforma/actions.ts` — tela do dono da plataforma
  (lista e libera/suspende empresas). Só abre para os e-mails de
  `PLATFORM_ADMIN_EMAILS` (variável da Vercel, não fica no banco); para os
  demais, `notFound()`.
- "Criar membro" (`equipe/actions.ts`) — cria o usuário e procura conta
  existente; exige dono/admin.
- Marca (`configuracoes/marca/actions.ts`) — upload do logo; exige dono/admin.
- Cobrança: "Contratar plano" (`configuracoes/plano/actions.ts`, exige
  dono/admin), o webhook do Asaas (`api/webhooks/asaas`, autenticado pelo
  token) e o cron gravam `subscriptions`/`subscription_payments`, que não têm
  política de escrita para usuários.

## Cobrança (Asaas)

Planos e preços em `src/lib/plans.ts` (vitrine, contratação e limite de
pessoas). Fluxo: na tela `/aguardando-liberacao` (ou em Configurações → Plano e
pagamento) o dono/admin escolhe plano e ciclo e informa nome, CPF/CNPJ e e-mail
da cobrança → `startSubscriptionAction` cria cliente e assinatura no Asaas
(`billingType: UNDEFINED`, o pagador escolhe Pix, boleto ou cartão) e manda a
pessoa para a fatura. Enquanto nada foi pago dá para trocar de plano (a
assinatura antiga é apagada no Asaas); depois, troca é manual.

O webhook (`/api/webhooks/asaas`, eventos em ordem, cabeçalho
`asaas-access-token` = `ASAAS_WEBHOOK_TOKEN`) mantém `subscription_payments` em
dia (`src/lib/billing-sync.ts`). Cobrança que passa a paga: empresa `pending` →
e-mail ao dono da plataforma, que libera; empresa suspensa com motivo
"Pagamento pendente" e sem outra vencida → reativada sozinha. O cron suspende
empresa ativa com cobrança vencida há 10 dias (`SUSPEND_AFTER_DAYS`), com esse
motivo. A situação (aguardando, em dia, atrasada) não é gravada: sai das
cobranças em `billingState` (`src/lib/billing.ts`, testada). Dono/admin vê aviso
de atraso no topo da área logada.

Limite do plano: "Criar membro" e convites param quando membros + convites
pendentes atingem o limite. Empresa sem assinatura (contratada antes) não tem limite.

Variáveis: `ASAAS_API_KEY` (o prefixo define o ambiente: `$aact_hmlg_` sandbox,
`$aact_prod_` produção — Preview usa sandbox) e `ASAAS_WEBHOOK_TOKEN`. O webhook é
cadastrado pelo botão em `/plataforma`, no site publicado; no site de testes a URL
leva `VERCEL_AUTOMATION_BYPASS_SECRET` (Protection Bypass for Automation), senão a
proteção da Vercel barra o Asaas.

Nota fiscal automática (`src/lib/nfse.ts`): liga quando existe
`ASAAS_NFSE_SETTINGS` (JSON com serviço municipal e impostos, por ambiente) e a
conta do Asaas tem as informações fiscais (inscrição municipal, certificado A1)
cadastradas no painel. Contratar já envia `invoiceSettings` à assinatura nova
(falha não impede o pagamento) e marca `subscriptions.nfse_configured_at`;
assinaturas antigas ganham a nota pelo botão em `/plataforma`. A nota sai na
confirmação do pagamento (`ON_PAYMENT_CONFIRMATION`); os eventos `INVOICE_*`
gravam situação, número e PDF em `subscription_payments` e, em erro, avisam o
dono da plataforma. Webhook cadastrado antes desses eventos precisa ser
reconfigurado (botão em `/plataforma`). A partir de 2027 o Simples Nacional
precisa dos códigos da reforma tributária (`nbsCode` etc.) em `taxes`.
A Client Cycle é do Simples Nacional em São Paulo e, desde 1º/11/2026, emite
pelo **Portal Nacional** (regra da Prefeitura de SP): o serviço vai em
`municipalServiceCode` (item da LC 116, "1.05") e o código de tributação
nacional em `taxes.federalServiceTaxCode` ("010501", sem pontos); o
`municipalServiceId` não vale nesse portal.

## Empresas aguardando liberação

`organizations.status`: `active` | `pending` | `suspended`. `organizations.is_demo`
marca a empresa de demonstração (dados fictícios). Empresa nova
(cadastro aberto → `create_organization_and_join`) nasce `pending`;
`requireOrganization()` manda para `/aguardando-liberacao` quem está numa empresa
não ativa. O dono da plataforma libera em `/plataforma` (e-mail avisa os donos da
empresa) e recebe e-mail quando uma empresa nova é criada. Usuário comum não tem política de UPDATE em
`organizations`, então só o service role muda o status. Suspender exige um
motivo (`organizations.status_reason`), mostrado para a empresa na tela de aviso;
liberar de novo apaga o motivo.

## Textos legais

`/privacidade` e `/termos` (rotas públicas no middleware), em nome da empresa
(razão social, CNPJ, endereço e encarregado de dados em
`src/app/(marketing)/legal.tsx`; o rodapé do site mostra os mesmos dados).
Descrevem regras reais — fornecedores, prazos de guarda (24 meses para
`support_requests`, aplicado pelo cron), cancelamento e o fato de o Estokei não
emitir nota fiscal de venda. Mudou alguma dessas regras? Atualize o texto,
`LEGAL_UPDATED` e `TERMS_VERSION`. O cadastro registra o aceite em
`user_metadata.terms_accepted_at`/`terms_version`.

## 3. Rotas de API ficam fora do middleware

O matcher em `src/middleware.ts` exclui `api/`. Ou seja: **nenhuma rota em
`src/app/api/` tem sessão verificada automaticamente.** Cada uma precisa
autenticar sozinha.

O padrão correto está em `src/app/api/cron/diario/route.ts`: exige
`Authorization: Bearer $CRON_SECRET`, compara em tempo constante e **falha
fechado** se a variável não existir. Não aceite header de user-agent como prova
de identidade — header é texto livre.

## 4. Segredos nunca vão para o cliente

Só `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e
`NEXT_PUBLIC_APP_URL` podem ter o prefixo `NEXT_PUBLIC_`. Qualquer outra
variável (service role, Resend, cron) é exclusiva do servidor.

`.env*` está no `.gitignore` e o histórico do git está limpo. Não commite `.env.local`.

---

# Modelo de dados

## Tabelas (base SaaS)

`organizations` (status `active`/`pending`/`suspended`, `is_demo`),
`organization_members` (papéis: `owner`/`admin`/`member`), `profiles`,
`invites`, `subscriptions` e `subscription_payments` (cobrança, veja
"Cobrança") e `support_requests` (pedidos da página /suporte).

Migration base: `supabase/migrations/20261112170000_saas_base.sql`. Ela foi
extraída do schema do ClientCycle sem as tabelas do CRM e sem colunas legadas
(`plan`, `trial_ends_at`, `subscription_status`, `custom_domain` não existem
aqui).

## Funções e triggers em SQL

`user_organization_ids` e `user_admin_organization_ids` (base do RLS),
`create_organization_and_join`, `accept_invite`, `get_invite_summary`,
`my_pending_invites`, `handle_new_user` (cria `profiles`), `protect_last_owner`
(impede remover o último dono), `touch_updated_at`, `set_last_updated_by`.

## Módulos da loja (a construir)

Toda tabela nova segue a regra 1 (organization_id + RLS com as quatro
políticas). Regras de estoque **moram no banco**: a baixa/entrada de estoque é
feita por função/trigger em SQL, numa transação, nunca calculada no navegador
(no Voltvix, a conta feita no navegador permitia duas vendas simultâneas se
sobrescreverem). Listas com paginação no servidor — o Supabase devolve no
máximo 1.000 linhas por consulta.

## Migrations

Uma migration por mudança, em `supabase/migrations/`, nomeada
`AAAAMMDDHHMMSS_descricao.sql`. Nunca edite uma migration já aplicada — crie outra.

**Não rode `supabase db push` à mão.** O push na `staging` (testes) e depois na
`main` (produção) aplica as migrations pendentes no banco de cada ambiente,
antes do deploy (veja "Ambientes e deploy" abaixo). A migration roda primeiro no
banco de testes — é onde um erro de SQL deve aparecer.

Entre a migration e o fim do deploy, a versão **anterior** do código continua
no ar por alguns minutos. Por isso toda migration precisa funcionar com o
código antigo: adicionar tabela/coluna é seguro; renomear ou remover coluna em
uso exige dois deploys (primeiro o código para de usar, depois a migration remove).

Tipos: atualize `src/lib/supabase/database.types.ts` junto com a migration
(pode ser à mão, seguindo o formato gerado). Depois que ela estiver aplicada,
confira contra o banco — gerando em arquivo temporário, porque em caso de erro o
comando grava a mensagem de erro no arquivo de destino:

```bash
npx supabase gen types typescript --linked > /tmp/db-types.ts
```

## Ambientes e deploy

| Branch    | Ambiente | Site                                                         | Banco Supabase                          |
|-----------|----------|--------------------------------------------------------------|-----------------------------------------|
| `staging` | testes   | preview da Vercel (quando o projeto for criado)              | `frwfxuwpxephhugylgkg` (estokei-staging, sem dado de cliente) |
| `main`    | produção | https://estokei.app.br                                       | `bmgidnbomikeconlfzgr` (estokei)        |

**Fluxo de trabalho (combinado com o Ricardo: toda mudança passa por testes):**

1. Commite na `staging` e dê push. Nunca commite direto na `main`.
2. Avise o Ricardo o que testar no site de testes. Ele só abre para quem está
   logado na conta Vercel dele (proteção de preview do plano Pro).
3. Depois que ele aprovar: `git checkout main && git merge --ff-only staging && git push`.

Push em qualquer uma das duas dispara `.github/workflows/deploy.yml`, que roda
em ordem: checagem de tipos → migrations no banco do ambiente → deploy na Vercel
(deploy hook da branch). Se uma etapa falha, as seguintes não rodam e o ambiente
fica na versão anterior. O deploy automático da Vercel nessas branches está
desligado em `vercel.json` (`git.deploymentEnabled`) — não remova, senão o
código pode entrar no ar antes da migration.

As migrations conectam com a senha do banco (secrets `SUPABASE_DB_PASSWORD` e
`SUPABASE_DB_PASSWORD_STAGING`), sem token pessoal do Supabase, que expira.

As funções da Vercel rodam em São Paulo (`"regions": ["gru1"]` em `vercel.json`),
perto do banco (sa-east-1) — não tire, senão cada tela faz ida e volta aos EUA.

Variáveis da Vercel: **Production** aponta para o banco de produção e tem Resend
e Sentry. **Preview** e **Development** apontam para o banco de testes e não têm
chave da Resend — nenhum teste manda e-mail. O cron só roda em produção.

---

# Convenções de código

## Mutação de dado = Server Action, nunca rota de API

Todo formulário grava por Server Action, em um `actions.ts` dentro da própria
pasta da rota. O padrão, sem exceção (veja `src/app/(app)/suporte/actions.ts`):

```ts
'use server'

export async function minhaAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { organization } = await requireOrganization()   // 1. autentica e pega a org
  const parsed = meuSchema.safeParse({ ... })            // 2. valida com zod
  if (!parsed.success) {
    return { ok: false, message: 'Corrija os campos destacados.',
             fieldErrors: parsed.error.flatten().fieldErrors }
  }
  const supabase = await createClient()                  // 3. cliente COM RLS
  // 4. grava sempre com organization_id: organization.id
  revalidatePath('/rota-afetada')                        // 5. revalida
  return { ok: true }
}
```

Erro volta como `FormState` para o formulário exibir. Não lance exceção crua
para o usuário.

## Autenticação

`src/lib/auth.ts` expõe dois helpers, ambos com `cache()` do React:

- `requireUser()` — redireciona para `/entrar` se não houver sessão
- `requireOrganization()` — devolve `{ user, role, organization, organizations }`
  e redireciona para `/onboard` se o usuário não pertencer a nenhuma organização

Um usuário pode estar em mais de uma empresa (ex.: tinha a própria e aceitou um
convite). A empresa em uso vem do cookie `ek_org`; sem ele (ou inválido), a de
entrada mais recente. O seletor no menu (`org-switcher.tsx`) só aparece para
quem tem mais de uma e troca via `switchOrganizationAction`, que também é
chamada ao aceitar um convite. Convite com e-mail só pode ser aceito por aquela
conta (`accept_invite` confere). "Criar membro" procura conta existente com o
cliente de serviço, porque o RLS de `profiles` esconde quem é de outra empresa.

Toda página autenticada e toda action começa por um deles. Nunca leia
`auth.getUser()` solto.

## Organização de arquivos

- `src/app/(app)/` — área logada (protegida pelo middleware)
- `src/app/(marketing)/` — site público
- `src/app/entrar`, `/cadastrar`, `/onboard`, `/convite/[token]` — fluxo de entrada
- `src/lib/` — lógica compartilhada; `src/lib/supabase/` — clientes e tipos
- Componentes específicos de uma rota ficam na pasta da rota. `src/components/ui/`
  existe mas só tem um `button.tsx` órfão — veja "Armadilhas conhecidas"

Server Component é o padrão. `'use client'` só onde há interatividade real.

## Detalhes

- Formatação BR: `formatDateBR` e `formatCurrencyBRL` em `src/lib/utils.ts`.
- Não há teste grátis (removido em out/2026). Os botões dos planos da landing
  levam ao WhatsApp (`src/lib/sales.ts`); o pagamento é feito dentro do sistema.
  As perguntas frequentes da landing ficam em `src/app/(marketing)/faq-section.tsx`
  — descrevem regras reais (planos, nota fiscal, cancelamento); mantenha em dia.
- Toasts com `sonner`. Ícones com `lucide-react`.
- Classes CSS combinadas com `cn()` de `src/lib/utils.ts`.

## Monitoramento de erro (Sentry)

Erro em produção é capturado e aparece em sentry.io, com alerta por e-mail —
**desde que `NEXT_PUBLIC_SENTRY_DSN` esteja cadastrada na Vercel** (confira com
`npx vercel env ls`; sem ela o Sentry fica desligado e nada é capturado).
Arquivos: `src/instrumentation.ts` (servidor + `onRequestError`),
`src/instrumentation-client.ts` (navegador), `src/sentry.server.config.ts`,
`src/sentry.edge.config.ts` e `src/app/global-error.tsx` (última barreira da UI).

Regras:

- **`sendDefaultPii` fica em `false`.** Ligar mandaria e-mail, IP e cabeçalhos
  dos usuários para um serviço de terceiro. Dado de cliente não sai do Supabase.
- Não há session replay nem widget de feedback, pelo mesmo motivo.
- O Sentry só liga quando `NEXT_PUBLIC_SENTRY_DSN` existe. Em desenvolvimento a
  variável fica vazia, então nada é enviado e a cota não é consumida.
- Para registrar um erro esperado sem quebrar a tela, use
  `Sentry.captureException(erro)` — não engula exceção em `catch` silencioso.

## E-mails e cron

`src/lib/email.ts` monta os templates (plataforma, cobrança, convites, suporte)
e envia via Resend. O remetente vem de `RESEND_FROM_EMAIL`. O cron
`/api/cron/diario` roda às 12:00 UTC (9h de Brasília), configurado em
`vercel.json`: suspende empresa com mensalidade vencida há 10 dias e aplica o
prazo de guarda das mensagens de suporte. Alertas por e-mail para a loja
(estoque mínimo, contas a vencer) ainda não existem; quando forem criados,
registre cada envio para não repetir o mesmo aviso todo dia.

Suporte: a página `/suporte` grava o pedido em `support_requests` e manda um
e-mail para `supportInboxEmail()` (`contato@clientcycle.com.br`, ou
`SUPPORT_INBOX_EMAIL`), com `replyTo` de quem escreveu — a resposta vai direto
para o usuário. Se o e-mail falhar, o pedido continua salvo e o Sentry recebe
um aviso só com os ids. Limite de 5 pedidos por pessoa por hora.

---

# Armadilhas conhecidas

- **`shadcn` e `tw-animate-css` NÃO são dependências mortas.** Eles não aparecem
  em nenhum `import` de TypeScript porque entram pelo CSS, em
  `src/app/globals.css` (`@import "shadcn/tailwind.css"`). Remover qualquer um
  dos dois quebra o estilo do app inteiro. Antes de tirar qualquer pacote,
  verifique também o CSS — não só os imports de `.ts`/`.tsx`.
- **Duas origens para `cn`.** O padrão do projeto é `cn` de `@/lib/utils`
  (clsx + tailwind-merge), usado em todo lugar. O `src/components/ui/button.tsx`
  importa do pacote npm `cn`, que é equivalente mas diferente. Em código novo,
  use sempre `@/lib/utils`.
- **`src/components/ui/` está praticamente vazio.** Só existe `button.tsx`, e
  ele não é importado por ninguém — é resquício de um `npx shadcn add`. As telas
  usam HTML + Tailwind direto. Não presuma que existe uma biblioteca de
  componentes interna pronta.
- Push na `main` vai para produção sem passar por ninguém. Trabalhe na `staging`
  (veja "Ambientes e deploy").

# O que não fazer

- Não criar rota de API para gravar dado — use Server Action.
- Não usar `createServiceClient()` em código que roda com usuário logado.
- Não criar tabela sem RLS e sem as quatro políticas de isolamento.
- Não editar migration já aplicada.
- Não duplicar no TypeScript regra que já existe em trigger do banco.
- Não commitar `.env.local`.
