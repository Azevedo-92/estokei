import { createElement, type ReactElement } from 'react'
import * as Sentry from '@sentry/nextjs'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import sharp from 'sharp'
import { requireOrganization } from '@/lib/auth'
import { resolveBrandColor } from '@/lib/branding'
import { sanitizeEnv } from '@/lib/supabase/env'
import { createClient } from '@/lib/supabase/server'
import { loadStoreProfile } from '@/lib/store-profile'
import { loadQuote } from '../../load-quote'
import { QuotePdf } from './quote-pdf'

export const dynamic = 'force-dynamic'

/**
 * Logo da empresa em PNG (o react-pdf não lê SVG nem WebP). Só busca no
 * storage do próprio Supabase — logo_url é gravado pela tela Marca.
 */
async function logoPng(url: string | null): Promise<string | null> {
  if (!url) return null
  const base = sanitizeEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL')
  if (!url.startsWith(`${base}/storage/`)) return null
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const input = Buffer.from(await res.arrayBuffer())
    const png = await sharp(input, { density: 300 })
      .resize({ height: 160, withoutEnlargement: true })
      .png()
      .toBuffer()
    return `data:image/png;base64,${png.toString('base64')}`
  } catch (err) {
    Sentry.captureException(err, { extra: { etapa: 'logo do orçamento' } })
    return null
  }
}

/** PDF do orçamento. Toda a equipe da empresa pode baixar (o RLS filtra). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { organization } = await requireOrganization()
  const { id } = await params
  const supabase = await createClient()

  const [quote, store, logo] = await Promise.all([
    loadQuote(supabase, organization.id, id),
    loadStoreProfile(supabase, organization.id),
    logoPng(organization.logo_url),
  ])
  if (!quote) return new Response('Orçamento não encontrado.', { status: 404 })

  const pdf = await renderToBuffer(
    createElement(QuotePdf, {
      quote,
      orgName: organization.name,
      store,
      logo,
      color: resolveBrandColor(organization.primary_color),
    }) as unknown as ReactElement<DocumentProps>, // QuotePdf devolve um <Document>
  )

  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="orcamento-${quote.number}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
