import { requireOrganization } from '@/lib/auth'
import { DEFAULT_BRAND_COLOR, resolveBrandColor } from '@/lib/branding'
import { BrandingForm } from './branding-form'

export const metadata = { title: 'Marca' }

export default async function MarcaPage() {
  const { organization, role } = await requireOrganization()
  const canEdit = role === 'owner' || role === 'admin'
  const currentColor = resolveBrandColor(organization.primary_color)

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Marca</h1>
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
      ) : (
        <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">
          Só owners e admins da organização podem editar a marca. Peça acesso pra alguém do time
          se precisar mudar algo aqui.
        </div>
      )}
    </div>
  )
}
