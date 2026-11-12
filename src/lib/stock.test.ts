import { describe, expect, it } from 'vitest'
import {
  formatQuantity,
  pageFromParam,
  pageRange,
  parseDecimalBR,
  sanitizeSearch,
  toInputBR,
} from './stock'

describe('parseDecimalBR', () => {
  it('lê o padrão brasileiro e o americano simples', () => {
    expect(parseDecimalBR('10,5')).toBe(10.5)
    expect(parseDecimalBR('1.234,56')).toBe(1234.56)
    expect(parseDecimalBR('R$ 39,90')).toBe(39.9)
    expect(parseDecimalBR('10.5')).toBe(10.5)
    expect(parseDecimalBR('7')).toBe(7)
    expect(parseDecimalBR('1.234.567')).toBe(1234567)
  })

  it('devolve null para vazio ou lixo', () => {
    expect(parseDecimalBR('')).toBeNull()
    expect(parseDecimalBR('   ')).toBeNull()
    expect(parseDecimalBR(null)).toBeNull()
    expect(parseDecimalBR('abc')).toBeNull()
    expect(parseDecimalBR('1,2,3')).toBeNull()
  })
})

describe('formatação', () => {
  it('quantidade sem zeros inúteis', () => {
    expect(formatQuantity(10)).toBe('10')
    expect(formatQuantity('2.500')).toBe('2,5')
    expect(formatQuantity(0.125)).toBe('0,125')
  })

  it('valor para campo de formulário', () => {
    expect(toInputBR(39.9, 2)).toBe('39,90')
    expect(toInputBR(1234.5, 2)).toBe('1234,50')
    expect(toInputBR('2.500')).toBe('2,5')
    expect(toInputBR(null)).toBe('')
  })
})

describe('busca e paginação', () => {
  it('tira caracteres que mudariam o filtro do PostgREST', () => {
    expect(sanitizeSearch('cimento,id.eq.1')).toBe('cimento id.eq.1')
    expect(sanitizeSearch('  tinta (18 L)* ')).toBe('tinta 18 L')
    expect(sanitizeSearch('x'.repeat(200))).toHaveLength(80)
  })

  it('página válida e faixa', () => {
    expect(pageFromParam(undefined)).toBe(1)
    expect(pageFromParam('3')).toBe(3)
    expect(pageFromParam('0')).toBe(1)
    expect(pageFromParam('abc')).toBe(1)
    expect(pageRange(1)).toEqual({ from: 0, to: 49 })
    expect(pageRange(3, 10)).toEqual({ from: 20, to: 29 })
  })
})
