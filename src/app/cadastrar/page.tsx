import Link from 'next/link'
import { Suspense } from 'react'
import { SignupForm } from './signup-form'
import { EstokeiMark } from '@/components/estokei-mark'

export const metadata = { title: 'Criar conta' }

export default function CadastrarPage() {
  return (
    <main
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{
        background:
          'radial-gradient(1200px 600px at 100% -10%, rgba(30,64,175,0.10), transparent 60%), radial-gradient(900px 500px at -10% 110%, rgba(79,70,229,0.08), transparent 55%), #fafafa',
      }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <EstokeiMark />
          <p className="mt-6 text-sm text-muted-foreground">Criar sua conta</p>
        </div>
        <div className="card-elev p-6 shadow-sm">
          <Suspense fallback={<div className="h-96" />}>
            <SignupForm />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Já tem conta?{' '}
          <Link href="/entrar" className="font-medium text-foreground hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </main>
  )
}
