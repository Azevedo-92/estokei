export type SupportKind = 'duvida' | 'problema' | 'sugestao'

export const SUPPORT_KINDS: {
  value: SupportKind
  label: string
  hint: string
  placeholder: string
}[] = [
  {
    value: 'duvida',
    label: 'Dúvida',
    hint: 'Como fazer algo no sistema',
    placeholder: 'Ex.: Como faço para importar meus clientes de uma planilha?',
  },
  {
    value: 'problema',
    label: 'Problema',
    hint: 'Algo não funcionou como esperado',
    placeholder:
      'Conte o que você estava fazendo, o que esperava que acontecesse e o que aconteceu. Se puder, diga em qual tela foi.',
  },
  {
    value: 'sugestao',
    label: 'Sugestão',
    hint: 'Uma ideia para melhorar',
    placeholder: 'Ex.: Seria ótimo poder filtrar os clientes pela data de vencimento.',
  },
]

export function supportKindLabel(kind: string): string {
  return SUPPORT_KINDS.find((k) => k.value === kind)?.label ?? kind
}
