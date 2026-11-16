import Link from 'next/link'
import { requireOrganization } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PAGE_SIZE, pageFromParam, pageRange, sanitizeSearch } from '@/lib/stock'
import { INPUT_CLASS } from '@/components/form-field'
import { Pagination } from '../pagination'

export const metadata = { title: 'Clientes' }

type SearchParams = { q?: string; pagina?: string; inativos?: string }

export default async function ClientesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { organization } = await requireOrganization()
  const params = await searchParams
  const q = sanitizeSearch(params.q)
  const showInactive = params.inativos === '1'
  const page = pageFromParam(params.pagina)
  const { from, to } = pageRange(page)

  const supabase = await createClient()
  let query = supabase
    .from('customers')
    .select('id, name, document, phone, email, active', { count: 'exact' })
    .eq('organization_id', organization.id)
  if (!showInactive) query = query.eq('active', true)
  if (q) {
    const digits = q.replace(/\D/g, '')
    const filters = [`name.ilike.%${q}%`]
    if (digits) filters.push(`document.ilike.%${digits}%`, `phone.ilike.%${digits}%`)
    query = query.or(filters.join(','))
  }
  const { data: customers, count, error } = await query.order('name').range(from, to)

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {count ?? 0} cliente{count === 1 ? '' : 's'}
            {showInactive ? ' (incluindo inativos)' : ''}.
          </p>
        </div>
        <Link
          href="/clientes/novo"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Novo cliente
        </Link>
      </header>

      <form className="flex flex-wrap items-center gap-3">
        <input
          name="q"
          defaultValue={params.q ?? ''}
          placeholder="Buscar por nome, CPF/CNPJ ou telefone"
          className={`${INPUT_CLASS} max-w-sm`}
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="inativos" value="1" defaultChecked={showInactive} />
          Mostrar inativos
        </label>
        <button type="submit" className="rounded-md border px-3 py-2 text-sm hover:bg-accent">
          Filtrar
        </button>
      </form>

      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          Não foi possível carregar os clientes. Atualize a página.
        </p>
      ) : !customers || customers.length === 0 ? (
        <p className="rounded-md border bg-card p-6 text-sm text-muted-foreground">
          {q ? 'Nenhum cliente encontrado com essa busca.' : 'Nenhum cliente cadastrado ainda.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Nome</th>
                <th className="px-4 py-2 font-medium">CPF / CNPJ</th>
                <th className="px-4 py-2 font-medium">Telefone</th>
                <th className="px-4 py-2 font-medium">E-mail</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/clientes/${c.id}`} className="hover:underline">
                      {c.name}
                    </Link>
                    {!c.active ? (
                      <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        inativo
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{c.document ?? '—'}</td>
                  <td className="px-4 py-3 tabular-nums">{c.phone ?? '—'}</td>
                  <td className="px-4 py-3">{c.email ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        basePath="/clientes"
        params={{ q: params.q, inativos: showInactive ? '1' : undefined }}
        page={page}
        pageSize={PAGE_SIZE}
        total={count ?? 0}
      />
    </div>
  )
}
