import * as Sentry from '@sentry/nextjs'

// O DSN só existe em produção (configurado na Vercel). Sem ele, o Sentry fica
// desligado — é assim que o ambiente local não polui o painel nem gasta a cota.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,

  // NUNCA ligar. Enviaria e-mail, IP e cabeçalhos dos usuários para fora.
  // Dado de cliente não sai do Supabase. (LGPD)
  sendDefaultPii: false,

  // Amostra de performance. 10% em produção é suficiente e não estoura a cota
  // do plano grátis. Coloque 0 para desligar o tracing por completo.
  tracesSampleRate: 0.1,
})

// Instrumenta a navegação entre rotas do App Router.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
