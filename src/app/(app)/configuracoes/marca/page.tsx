import { requireOrganization } from '@/lib/auth'
import { DEFAULT_BRAND_COLOR, resolveBrandColor } from '@/lib/branding'
import { createClient } from '@/lib/supabase/server'
import { loadStoreProfile } from '@/lib/store-profile'
import { BrandingForm } from './branding-form'
import { StoreForm } from './store-form'

export const metadata = { title: 'Marca e loja' }

export default async function MarcaPage() {
  const { organization, role } = await requireOrganization()
  const canEdit = role === 'owner' || role === 'admin'
  const currentColor = resolveBrandColor(organization.primary_color)
  const store = canEdit ? await loadStoreProfile(await createClient(), organization.id) : null

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Marca e loja</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Personalize a identidade visual da {organization.name} no Estokei. Aparece pra
          todos os membros da equipe.
        </p>
      </header>

      {canEdit ? (
        <BrandingForm
          organizationName={organization.name}
          logoUrl={organization.logo_url}
          currentColor={currentColor}
          defaultColor={DEFAULT_BRAND_COLOR}
        />
      ) : null}
      {canEdit && store ? <StoreForm initial={store} /> : null}
      {!canEdit ? (
        <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">
          Só owners e admins da organização podem editar a marca. Peça acesso pra alguém do time
          se precisar mudar algo aqui.
        </div>
      ) : null}
    </div>
  )
}
