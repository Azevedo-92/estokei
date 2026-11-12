'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { createMemberAction, type MemberCreateState } from './actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
    >
      {pending ? 'Cadastrando…' : 'Cadastrar membro'}
    </button>
  )
}

export function CreateMemberForm() {
  const [state, action] = useActionState<MemberCreateState, FormData>(
    createMemberAction,
    { ok: true }
  )
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!state.message) return
    if (state.ok) {
      toast.success(state.message)
      formRef.current?.reset()
    } else {
      toast.error(state.message)
    }
  }, [state])

  const err = (n: string) => state.fieldErrors?.[n]?.[0]

  return (
    <form
      ref={formRef}
      action={action}
      className="rounded-lg border bg-card p-6 space-y-4"
    >
      <div>
        <h2 className="text-base font-semibold">Cadastrar membro manualmente</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Crie a conta direto — sem envio de convite. O membro entra com o e-mail e a senha que
          você definir.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Nome completo <span className="text-destructive">*</span>
          </label>
          <input
            name="full_name"
            required
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          {err('full_name') ? (
            <p className="text-xs text-destructive mt-1">{err('full_name')}</p>
          ) : null}
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            E-mail <span className="text-destructive">*</span>
          </label>
          <input
            name="email"
            type="email"
            required
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          {err('email') ? (
            <p className="text-xs text-destructive mt-1">{err('email')}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Senha inicial <span className="text-destructive">*</span>
          </label>
          <input
            name="password"
            type="text"
            required
            minLength={8}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring font-mono"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Mínimo 8 caracteres. Compartilhe com o membro fora do sistema.
          </p>
          {err('password') ? (
            <p className="text-xs text-destructive mt-1">{err('password')}</p>
          ) : null}
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Papel</label>
          <select
            name="role"
            defaultValue="member"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="member">Membro</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  )
}
