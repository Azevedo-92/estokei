import Link from 'next/link'
import { requireOrganization } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { canManageTeam } from '@/lib/team'
import { PAGE_SIZE, pageFromParam, pageRange, sanitizeSearch } from '@/lib/stock'
import { INPUT_CLASS } from '@/components/form-field'
import { Pagination } from '../pagination'

export const metadata = { title: 'Fornecedores' }

type SearchParams = { q?: string; pagina?: string; inativos?: string }

export default async function FornecedoresPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { organization, role } = await requireOrganization()
  const canManage = canManageTeam(role)
  const params = await searchParams
  const q = sanitizeSearch(params.q)
  const showInactive = params.inativos === '1'
  const page = pageFromParam(params.pagina)
  const { from, to } = pageRange(page)

  const supabase = await createClient()
  let query = supabase
    .from('suppliers')
    .select('id, name, document, contact_name, phone, email, active', { count: 'exact' })
    .eq('organization_id', organization.id)
  if (!showInactive) query = query.eq('active', true)
  if (q) query = query.or(`name.ilike.%${q}%,contact_name.ilike.%${q}%,document.ilike.%${q.replace(/\D/g, '') || q}%`)
  const { data: suppliers, count, error } = await query.order('name').range(from, to)

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Fornecedores</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {count ?? 0} fornecedor{count === 1 ? '' : 'es'}
            {showInactive ? ' (incluindo inativos)' : ''}.
          </p>
        </div>
        {canManage ? (
          <Link
            href="/fornecedores/novo"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Novo fornecedor
          </Link>
        ) : null}
      </header>

      <form className="flex flex-wrap items-center gap-3">
        <input
          name="q"
          defaultValue={params.q ?? ''}
          placeholder="Buscar por nome, contato ou CNPJ"
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
          Não foi possível carregar os fornecedores. Atualize a página.
        </p>
      ) : !suppliers || suppliers.length === 0 ? (
        <p className="rounded-md border bg-card p-6 text-sm text-muted-foreground">
          {q ? 'Nenhum fornecedor encontrado com essa busca.' : 'Nenhum fornecedor cadastrado ainda.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Nome</th>
                <th className="px-4 py-2 font-medium">CNPJ / CPF</th>
                <th className="px-4 py-2 font-medium">Contato</th>
                <th className="px-4 py-2 font-medium">Telefone</th>
                <th className="px-4 py-2 font-medium">E-mail</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-4 py-3 font-medium">
                    {canManage ? (
                      <Link href={`/fornecedores/${s.id}`} className="hover:underline">
                        {s.name}
                      </Link>
                    ) : (
                      s.name
                    )}
                    {!s.active ? (
                      <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        inativo
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{s.document ?? '—'}</td>
                  <td className="px-4 py-3">{s.contact_name ?? '—'}</td>
                  <td className="px-4 py-3 tabular-nums">{s.phone ?? '—'}</td>
                  <td className="px-4 py-3">{s.email ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        basePath="/fornecedores"
        params={{ q: params.q, inativos: showInactive ? '1' : undefined }}
        page={page}
        pageSize={PAGE_SIZE}
        total={count ?? 0}
      />
    </div>
  )
}
