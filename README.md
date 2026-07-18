# Roteiros

Aplicação para criar e compartilhar roteiros de viagem, construída com [TanStack Start](https://tanstack.com/start) (React 19 + Vite), [shadcn/ui](https://ui.shadcn.com), [Drizzle ORM](https://orm.drizzle.team) (Postgres), [Better Auth](https://www.better-auth.com) e i18n type-safe com [Paraglide](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) (pt-BR e en).

## Requisitos

- Node 22+
- pnpm
- PostgreSQL 16+

## Setup

```bash
pnpm install

# variáveis de ambiente
cp .env.example .env.local
# edite DATABASE_URL e gere um segredo: pnpm dlx @better-auth/cli secret

# banco de dados (exemplo local)
# CREATE ROLE roteiros LOGIN PASSWORD 'roteiros';
# CREATE DATABASE roteiros OWNER roteiros;
pnpm db:migrate

pnpm dev # http://localhost:3000
```

## Scripts

```bash
pnpm dev             # dev server na porta 3000
pnpm build           # build de produção
pnpm test            # testes (Vitest)
pnpm lint            # eslint
pnpm format          # prettier + eslint --fix
pnpm db:generate     # gera migrations a partir de src/db/schema.ts
pnpm db:migrate      # aplica migrations
pnpm db:studio       # Drizzle Studio
```

## Estrutura

- `src/routes/` — rotas file-based (TanStack Router); `src/routes/api/auth/$.ts` expõe o Better Auth
- `src/db/` — cliente Drizzle, `schema.ts` (entrada única) e `auth-schema.ts` (tabelas do Better Auth)
- `src/lib/auth.ts` — configuração do Better Auth (adapter Drizzle/Postgres)
- `src/components/ui/` — componentes shadcn/ui (estilo new-york, base zinc)
- `messages/` + `project.inlang/` — mensagens i18n (pt-BR, en) compiladas pelo Paraglide para `src/paraglide/`
- `drizzle/` — migrations SQL geradas

## Skills de agente (IA)

O projeto está preparado para agentes de código:

- `AGENTS.md` — mapeamentos do TanStack Intent (Router, Start, Query, Form, etc.)
- `.agents/skills/` — skill oficial do shadcn/ui (symlink em `.claude/skills/`)
- `.claude/settings.json` — plugin [Superpowers](https://github.com/obra/superpowers) habilitado

## shadcn/ui

Adicione componentes com:

```bash
pnpm dlx shadcn@latest add button
```

Observação: em ambientes cujo proxy bloqueia `ui.shadcn.com`, os componentes podem ser copiados do registry no GitHub (`shadcn-ui/ui`, pasta `apps/v4/registry/new-york-v4/ui`), ajustando os imports `@/` para `#/`.
