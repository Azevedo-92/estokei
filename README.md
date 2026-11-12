# Estokei

Sistema de gestão para comércio com estoque e balcão: PDV, controle de estoque,
orçamentos em PDF e financeiro. SaaS multiempresa, mantido pela Client Cycle
Consultoria em TI Ltda.

- Guia técnico completo (regras de segurança, ambientes, deploy): [CLAUDE.md](CLAUDE.md)
- Variáveis de ambiente: [.env.example](.env.example)

## Rodar localmente

```bash
npm ci
cp .env.example .env.local   # preencha com as chaves do projeto estokei-staging
npm run dev                  # http://localhost:3000
```

## Checagens antes de enviar

```bash
npx tsc --noEmit
npm run lint
npm test
npm run build
```
