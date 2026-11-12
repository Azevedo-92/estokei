import { Suspense } from 'react'
import Link from 'next/link'
import { EstokeiMark } from '@/components/estokei-mark'
import { RequestResetForm } from './request-reset-form'

export const metadata = { title: 'Esqueci minha senha' }

export default function RedefinirSenhaPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 bg-muted/30">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <EstokeiMark />
          <p className="mt-6 text-sm text-muted-foreground">Criar uma senha nova</p>
        </div>
        <div className="card-elev p-6 shadow-sm">
          <Suspense fallback={<div className="h-40" />}>
            <RequestResetForm />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Lembrou a senha?{' '}
          <Link href="/entrar" className="font-medium text-foreground hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </main>
  )
}
