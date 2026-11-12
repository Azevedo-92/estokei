import { Suspense } from 'react'
import Link from 'next/link'
import { LoginForm } from './login-form'
import { EstokeiMark } from '@/components/estokei-mark'

export const metadata = { title: 'Entrar' }

export default function EntrarPage() {
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
          <p className="mt-6 text-sm text-muted-foreground">Entrar na sua conta</p>
        </div>
        <div className="card-elev p-6 shadow-sm">
          <Suspense fallback={<div className="h-64" />}>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Ainda não tem conta?{' '}
          <Link href="/cadastrar" className="font-medium text-foreground hover:underline">
            Criar conta
          </Link>
        </p>
      </div>
    </main>
  )
}
