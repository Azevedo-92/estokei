import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Testes das regras puras (datas, alertas, prazos, valores). Rodam com fuso
// de Nova York de propósito: as regras têm que dar o mesmo resultado em
// qualquer fuso — o servidor da Vercel e o navegador do usuário não estão
// necessariamente em Brasília.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'src') },
  },
  test: {
    include: ['src/**/*.test.ts'],
    env: { TZ: 'America/New_York' },
  },
})
