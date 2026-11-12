import { afterEach, describe, expect, it, vi } from 'vitest'
import { isPlatformAdmin } from './platform'

afterEach(() => vi.unstubAllEnvs())

describe('isPlatformAdmin', () => {
  it('só libera e-mails da lista, sem diferenciar maiúsculas e espaços', () => {
    vi.stubEnv('PLATFORM_ADMIN_EMAILS', 'dono@exemplo.com, Outro@Exemplo.com ')
    expect(isPlatformAdmin('dono@exemplo.com')).toBe(true)
    expect(isPlatformAdmin(' OUTRO@exemplo.com')).toBe(true)
    expect(isPlatformAdmin('intruso@exemplo.com')).toBe(false)
  })

  it('sem lista configurada, ninguém é dono da plataforma', () => {
    vi.stubEnv('PLATFORM_ADMIN_EMAILS', '')
    expect(isPlatformAdmin('dono@exemplo.com')).toBe(false)
    expect(isPlatformAdmin(null)).toBe(false)
    expect(isPlatformAdmin('')).toBe(false)
  })

  it('não aceita e-mail parecido', () => {
    vi.stubEnv('PLATFORM_ADMIN_EMAILS', 'dono@exemplo.com')
    expect(isPlatformAdmin('dono@exemplo.com.br')).toBe(false)
    expect(isPlatformAdmin('xdono@exemplo.com')).toBe(false)
  })
})
