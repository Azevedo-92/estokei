import { describe, expect, it } from 'vitest'
import { invoiceDescription, invoiceSettingsBody, invoiceStatusLabel, parseNfseSettings } from './nfse'

const valid = {
  municipalServiceCode: '01234',
  municipalServiceName: 'Licenciamento de uso de software',
  taxes: { retainIss: false, iss: 2, pis: 0, cofins: 0, csll: 0, inss: 0, ir: 0, nbsCode: '1.0000.00.00' },
}

describe('configuração da nota fiscal', () => {
  it('sem variável ou com JSON inválido fica desligada', () => {
    expect(parseNfseSettings(undefined)).toBeNull()
    expect(parseNfseSettings('')).toBeNull()
    expect(parseNfseSettings('{nao e json')).toBeNull()
    expect(parseNfseSettings(JSON.stringify({ ...valid, taxes: { iss: 2 } }))).toBeNull()
  })

  it('aceita o JSON válido (com BOM do PowerShell)', () => {
    expect(parseNfseSettings('﻿' + JSON.stringify(valid))).toMatchObject({ municipalServiceCode: '01234' })
  })

  it('exige id OU código do serviço, nunca os dois', () => {
    expect(parseNfseSettings(JSON.stringify({ ...valid, municipalServiceId: '99' }))).toBeNull()
    const semCodigo: Partial<typeof valid> = { ...valid }
    delete semCodigo.municipalServiceCode
    expect(parseNfseSettings(JSON.stringify(semCodigo))).toBeNull()
    expect(parseNfseSettings(JSON.stringify({ ...semCodigo, municipalServiceId: '99' }))).not.toBeNull()
  })

  it('Portal Nacional: aceita o código de tributação nacional com 6 dígitos', () => {
    const portal = { ...valid, municipalServiceCode: '1.05', taxes: { ...valid.taxes, federalServiceTaxCode: '010501' } }
    expect(parseNfseSettings(JSON.stringify(portal))?.taxes.federalServiceTaxCode).toBe('010501')
    expect(invoiceSettingsBody(parseNfseSettings(JSON.stringify(portal))!, 'x').taxes).toMatchObject({ federalServiceTaxCode: '010501' })
    const errado = { ...portal, taxes: { ...portal.taxes, federalServiceTaxCode: '01.05.01' } }
    expect(parseNfseSettings(JSON.stringify(errado))).toBeNull()
  })

  it('configuração validada pelo contador: sem código municipal, com código nacional e NBS', () => {
    const contador = {
      municipalServiceName: 'Licenciamento de uso de software (SaaS) – sistema Estokei',
      taxes: { retainIss: false, iss: 2, pis: 0, cofins: 0, csll: 0, inss: 0, ir: 0, federalServiceTaxCode: '010501', nbsCode: '1.1506.21.00' },
    }
    const s = parseNfseSettings(JSON.stringify(contador))
    expect(s).not.toBeNull()
    const body = invoiceSettingsBody(s!, 'x')
    expect(body).not.toHaveProperty('municipalServiceCode')
    expect(body).not.toHaveProperty('municipalServiceId')
    expect(body.taxes).toMatchObject({ iss: 2, federalServiceTaxCode: '010501', nbsCode: '1.1506.21.00' })
  })

  it('descrição da nota com plano, ciclo e vigência', () => {
    expect(invoiceDescription('profissional', 'yearly')).toBe(
      'Licenciamento de uso do software Estokei (SaaS) – plano Profissional, assinatura anual, vigência de 12 meses a partir da data do pagamento'
    )
    expect(invoiceDescription('essencial', 'monthly')).toContain('assinatura mensal, vigência de 1 mês')
  })

  it('percentual fora de 0–100 é recusado', () => {
    expect(parseNfseSettings(JSON.stringify({ ...valid, taxes: { ...valid.taxes, iss: 200 } }))).toBeNull()
  })

  it('monta o corpo do invoiceSettings', () => {
    const body = invoiceSettingsBody(parseNfseSettings(JSON.stringify(valid))!, 'Plano Profissional (anual)')
    expect(body).toEqual({
      municipalServiceCode: '01234',
      municipalServiceName: 'Licenciamento de uso de software',
      effectiveDatePeriod: 'ON_PAYMENT_CONFIRMATION',
      observations: 'Plano Profissional (anual)',
      taxes: valid.taxes,
    })
  })

  it('rótulos da situação da nota', () => {
    expect(invoiceStatusLabel(null)).toBeNull()
    expect(invoiceStatusLabel('AUTHORIZED')).toBe('Emitida')
    expect(invoiceStatusLabel('SCHEDULED')).toBe('Em emissão')
    expect(invoiceStatusLabel('ERROR')).toBe('Com erro')
  })
})
