import Link from 'next/link'

/**
 * Navegação "Anterior / Próxima" para listas paginadas no servidor.
 * `params` são os filtros atuais da URL, mantidos ao trocar de página.
 */
export function Pagination({
  basePath,
  params,
  page,
  pageSize,
  total,
}: {
  basePath: string
  params: Record<string, string | undefined>
  page: number
  pageSize: number
  total: number
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null

  const href = (p: number) => {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v)
    if (p > 1) sp.set('pagina', String(p))
    const qs = sp.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }

  const linkClass = 'rounded-md border px-3 py-1.5 text-sm hover:bg-accent'
  const disabledClass = 'rounded-md border px-3 py-1.5 text-sm opacity-40 pointer-events-none'

  return (
    <nav className="flex items-center justify-between gap-3 text-sm" aria-label="Paginação">
      <span className="text-muted-foreground">
        Página {page} de {pages}
      </span>
      <div className="flex gap-2">
        <Link href={href(page - 1)} className={page > 1 ? linkClass : disabledClass} aria-disabled={page <= 1}>
          Anterior
        </Link>
        <Link href={href(page + 1)} className={page < pages ? linkClass : disabledClass} aria-disabled={page >= pages}>
          Próxima
        </Link>
      </div>
    </nav>
  )
}
