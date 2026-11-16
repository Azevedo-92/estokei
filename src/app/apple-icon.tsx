import { ImageResponse } from 'next/og'
import { markDataUrl } from '@/lib/brand-mark'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'


/**
 * Ícone usado quando o usuário adiciona o Estokei à tela de início no iOS.
 * Renderiza a caixa da marca em cima de fundo branco, para ficar visível na
 * tela inicial do celular.
 */
export default function AppleIcon() {
  const svgUrl = markDataUrl()
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          background: 'white',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={svgUrl} alt="" width={140} height={140} />
      </div>
    ),
    { ...size }
  )
}
