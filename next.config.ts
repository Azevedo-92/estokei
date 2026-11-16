import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig: NextConfig = {
  // O gerador de PDF dos relatórios usa módulos nativos/wasm: fica fora do bundle.
  serverExternalPackages: ['@react-pdf/renderer'],
}

// org/project/auth token existem só no build da Vercel — servem para enviar os
// source maps e transformar o stack trace minificado em código legível.
// Sem eles o build funciona normalmente, apenas com um aviso.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
})
