import { z } from 'zod'
import { CYCLE_LABEL, getPlan, type BillingCycle } from '@/lib/plans'

// Nota fiscal automática (NFS-e) emitida pelo Asaas a cada pagamento confirmado.
//
// Os dados fiscais (serviço e impostos, definidos pelo contador) ficam na
// variável de servidor ASAAS_NFSE_SETTINGS (JSON), uma por ambiente — o id do
// serviço pode mudar entre a conta de testes e a de produção. Sem a variável,
// ou com JSON inválido, a nota automática fica desligada e a nota é emitida à
// mão. Antes de ligar, a conta do Asaas precisa das informações fiscais
// (inscrição municipal, certificado A1), cadastradas no painel do Asaas.
//
// A Client Cycle (Simples Nacional, São Paulo) emite pelo Portal Nacional desde
// 1º/11/2026: o serviço é identificado pelo código de tributação nacional em
// taxes.federalServiceTaxCode (6 dígitos); o código municipal é opcional e, por
// orientação do contador, fica em branco. Configuração validada pelo contador
// (nov/2026): ISS 2% (Anexo III, 1ª faixa), sem retenções, NBS 1.1506.21.00 (SaaS):
// {"municipalServiceName":"Licenciamento de uso de software (SaaS) – sistema Estokei",
//  "taxes":{"retainIss":false,"iss":2,"pis":0,"cofins":0,"csll":0,"inss":0,"ir":0,
//           "federalServiceTaxCode":"010501","nbsCode":"1.1506.21.00"}}
// O ISS muda quando o faturamento mudar de faixa no Simples — confirme com o contador.
// Docs: https://docs.asaas.com/docs/emitir-notas-fiscais-automaticamente-para-assinaturas

const percent = z.number().min(0).max(100)

const settingsSchema = z
  .object({
    /** Id do serviço na lista da prefeitura (GET /v3/fiscalInfo/services)... */
    municipalServiceId: z.string().min(1).optional(),
    /** ...ou o código municipal do serviço. Nunca os dois; no Portal Nacional, opcional. */
    municipalServiceCode: z.string().min(1).optional(),
    municipalServiceName: z.string().min(1).max(250),
    /** Percentuais (%). retainIss: o tomador retém o ISS. */
    taxes: z.object({
      retainIss: z.boolean(),
      iss: percent,
      pis: percent,
      cofins: percent,
      csll: percent,
      inss: percent,
      ir: percent,
      /** Código de tributação nacional (Portal Nacional), 6 dígitos — ex.: 010501. */
      federalServiceTaxCode: z.string().regex(/^\d{6}$/).optional(),
      // Reforma tributária (IBS/CBS): obrigatórios para o Simples Nacional a partir de 2027.
      nbsCode: z.string().min(1).optional(),
      taxSituationCode: z.string().min(1).optional(),
      taxClassificationCode: z.string().min(1).optional(),
      operationIndicatorCode: z.string().min(1).optional(),
    }),
  })
  .refine(
    (s) =>
      !(s.municipalServiceId && s.municipalServiceCode) &&
      !!(s.municipalServiceId || s.municipalServiceCode || s.taxes.federalServiceTaxCode),
    {
      message:
        'Informe o serviço: municipalServiceId, municipalServiceCode ou taxes.federalServiceTaxCode (id e código municipal nunca juntos).',
    }
  )

export type NfseSettings = z.infer<typeof settingsSchema>

/** Lê e valida o JSON da configuração; null = nota automática desligada. */
export function parseNfseSettings(raw: string | undefined | null): NfseSettings | null {
  const text = raw?.replace(/^﻿/, '').trim()
  if (!text) return null
  try {
    const parsed = settingsSchema.safeParse(JSON.parse(text))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export function nfseSettings(): NfseSettings | null {
  return parseNfseSettings(process.env.ASAAS_NFSE_SETTINGS)
}

/** Corpo de POST /v3/subscriptions/{id}/invoiceSettings. */
export function invoiceSettingsBody(settings: NfseSettings, description: string) {
  return {
    ...(settings.municipalServiceId ? { municipalServiceId: settings.municipalServiceId } : {}),
    ...(settings.municipalServiceCode ? { municipalServiceCode: settings.municipalServiceCode } : {}),
    municipalServiceName: settings.municipalServiceName,
    // A nota sai quando o pagamento é confirmado (Pix e cartão na hora; boleto
    // quando compensa) — nunca para cobrança não paga.
    effectiveDatePeriod: 'ON_PAYMENT_CONFIRMATION',
    observations: description,
    taxes: settings.taxes,
  }
}

/**
 * Discriminação do serviço na nota (texto validado pelo contador): plano,
 * ciclo e vigência contada da data do pagamento.
 */
export function invoiceDescription(plan: string, cycle: string): string {
  const yearly = cycle === 'yearly'
  return `Licenciamento de uso do software Estokei (SaaS) – plano ${getPlan(plan)?.name ?? plan}, assinatura ${
    CYCLE_LABEL[cycle as BillingCycle] ?? cycle
  }, vigência de ${yearly ? '12 meses' : '1 mês'} a partir da data do pagamento`
}

/** Texto curto da situação da nota, para a tela de pagamentos. */
export function invoiceStatusLabel(status: string | null): string | null {
  switch (status) {
    case null:
      return null
    case 'AUTHORIZED':
      return 'Emitida'
    case 'SCHEDULED':
    case 'SYNCHRONIZED':
      return 'Em emissão'
    case 'ERROR':
      return 'Com erro'
    case 'CANCELED':
    case 'PROCESSING_CANCELLATION':
      return 'Cancelada'
    default:
      return 'Em análise'
  }
}
