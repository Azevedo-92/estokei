import { describe, expect, it } from 'vitest'
import { formatDocument, formatPhoneBR } from './store-profile'

describe('formatDocument / formatPhoneBR', () => {
  it('formata CPF, CNPJ e telefone', () => {
    expect(formatDocument('12345678901')).toBe('123.456.789-01')
    expect(formatDocument('12345678000199')).toBe('12.345.678/0001-99')
    expect(formatDocument(null)).toBe('')
    expect(formatPhoneBR('11999998888')).toBe('(11) 99999-8888')
    expect(formatPhoneBR('1133334444')).toBe('(11) 3333-4444')
    expect(formatPhoneBR('123')).toBe('123')
  })
})
