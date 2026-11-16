'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

// Última barreira: só dispara quando o erro escapa do layout raiz.
// Por isso precisa renderizar <html> e <body> por conta própria.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="pt-BR">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          margin: 0,
          padding: '1.5rem',
          background: '#f8fafc',
          color: '#0f172a',
        }}
      >
        <main style={{ maxWidth: '28rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 0.5rem' }}>
            Algo deu errado
          </h1>
          <p style={{ color: '#475569', lineHeight: 1.5, margin: '0 0 1.5rem' }}>
            A falha já foi registrada e a equipe foi avisada automaticamente.
            Tente novamente em instantes.
          </p>
          <button
            onClick={() => reset()}
            style={{
              background: '#ea580c',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              padding: '0.625rem 1.25rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Tentar novamente
          </button>
          {error.digest && (
            <p style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: '#94a3b8' }}>
              Código do erro: {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  )
}
