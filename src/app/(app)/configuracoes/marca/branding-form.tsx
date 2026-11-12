'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { contrastText } from '@/lib/branding'
import { EstokeiMark } from '@/components/estokei-mark'
import { updateBrandingAction, type BrandingFormState } from './actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
    >
      {pending ? 'Salvando…' : 'Salvar marca'}
    </button>
  )
}

export function BrandingForm({
  organizationName,
  logoUrl,
  currentColor,
  defaultColor,
}: {
  organizationName: string
  logoUrl: string | null
  currentColor: string
  defaultColor: string
}) {
  const [state, action] = useActionState<BrandingFormState, FormData>(
    updateBrandingAction,
    { ok: true }
  )
  const [color, setColor] = useState(currentColor)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [removeLogo, setRemoveLogo] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!state.message) return
    if (state.ok) toast.success(state.message)
    else toast.error(state.message)
  }, [state])

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) {
      setLogoPreview(null)
      return
    }
    setRemoveLogo(false)
    const reader = new FileReader()
    reader.onload = () => setLogoPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const previewImg = logoPreview ?? (removeLogo ? null : logoUrl)

  return (
    <form action={action} className="space-y-6" encType="multipart/form-data">
      <input type="hidden" name="remove_logo" value={removeLogo ? 'true' : 'false'} />

      <section className="rounded-lg border bg-card p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold">Logo</h2>
          <p className="text-xs text-muted-foreground mt-1">
            PNG, JPG, WEBP ou SVG · até 1MB. Quadrado funciona melhor (48×48 mín.). Aparece no
            topo do sidebar de todos os membros.
          </p>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="h-20 w-20 rounded-lg border bg-muted/30 flex items-center justify-center overflow-hidden">
            {previewImg ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewImg}
                alt={organizationName}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <span className="text-xs text-muted-foreground text-center px-2">
                Sem logo
              </span>
            )}
          </div>
          <div className="flex-1 min-w-[200px] space-y-2">
            <input
              ref={fileRef}
              type="file"
              name="logo"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={onFileChange}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-2 file:text-sm file:hover:bg-accent file:cursor-pointer"
            />
            {logoUrl && !removeLogo && !logoPreview ? (
              <button
                type="button"
                onClick={() => {
                  setRemoveLogo(true)
                  setLogoPreview(null)
                  if (fileRef.current) fileRef.current.value = ''
                }}
                className="text-xs text-destructive hover:underline"
              >
                Remover logo (volta pra marca default do Estokei)
              </button>
            ) : null}
            {removeLogo ? (
              <p className="text-xs text-amber-700">
                Logo será removida ao salvar. Cancelar?{' '}
                <button
                  type="button"
                  onClick={() => setRemoveLogo(false)}
                  className="underline"
                >
                  Manter logo atual
                </button>
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold">Cor primária</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Vira o destaque colorido do topo do sidebar. Aceita hex (#RRGGBB).
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="color"
            name="primary_color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-12 w-16 rounded-md border cursor-pointer"
          />
          <input
            type="text"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            maxLength={7}
            className="w-32 rounded-md border bg-background px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onClick={() => setColor(defaultColor)}
            className="text-xs text-muted-foreground hover:underline"
          >
            Voltar ao default ({defaultColor})
          </button>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-6 space-y-3">
        <h2 className="text-base font-semibold">Prévia do sidebar</h2>
        <div className="rounded-lg border bg-card p-0 overflow-hidden max-w-xs">
          <div
            className="px-5 py-5 border-b"
            style={{ borderTopColor: color, borderTopWidth: '3px', borderTopStyle: 'solid' }}
          >
            {previewImg ? (
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewImg}
                  alt={organizationName}
                  className="h-8 w-8 rounded-md object-contain bg-muted/40"
                />
                <div className="text-sm font-semibold truncate">{organizationName}</div>
              </div>
            ) : (
              <div>
                <EstokeiMark />
                <div className="mt-2 text-xs text-muted-foreground truncate">
                  {organizationName}
                </div>
              </div>
            )}
          </div>
          <div className="p-3 text-xs text-muted-foreground">
            <div>Painel</div>
            <div className="mt-1">PDV</div>
            <div className="mt-1">Estoque</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span
            className="inline-flex items-center rounded-md px-2 py-1"
            style={{ background: color, color: contrastText(color) }}
          >
            Exemplo de botão
          </span>
          <span className="text-muted-foreground">← contraste do texto sobre a cor</span>
        </div>
      </section>

      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  )
}
