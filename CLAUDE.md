# Roteiros — guia para agentes

App de roteiros de viagem compartilhados. Stack: TanStack Start (React 19), shadcn/ui, Drizzle + Postgres, Better Auth, Paraglide (i18n pt-BR/en), TanStack Query/Form, Tailwind v4.

@AGENTS.md

## Política de documentação e boas práticas

Sempre siga as melhores práticas da biblioteca envolvida ANTES de escrever código:

1. **Skill primeiro.** Se existe uma skill instalada para a tarefa, use-a:
   - Bibliotecas TanStack (Router, Start, Devtools) → mapeamentos TanStack Intent no `AGENTS.md` (rode o comando `load` indicado)
   - shadcn/ui → skill `shadcn` (`.claude/skills/shadcn`)
   - Padrões React/UI → skills `vercel-react-best-practices`, `vercel-composition-patterns`, `web-design-guidelines`
2. **Sem skill? Use o Context7.** Para bibliotecas sem skill instalada — **Better Auth, Drizzle ORM, Paraglide/inlang, TanStack Query, TanStack Form, Tailwind, Zod, Vitest** — busque a documentação atual pelo MCP `context7` (configurado em `.mcp.json`) antes de implementar. Não confie apenas em conhecimento de treinamento para APIs dessas libs.
3. Se o Context7 estiver inacessível (proxy restrito), consulte o repositório GitHub oficial da lib (raw.githubusercontent.com costuma ser permitido).

## Convenções do projeto

- Alias de import: `#/` → `src/` (ex.: `#/components/ui/button`)
- Schema do banco: tabelas em `src/db/`, sempre re-exportadas por `src/db/schema.ts`; migrations com `pnpm db:generate` + `pnpm db:migrate`
- Auth: configuração em `src/lib/auth.ts` (server) e `src/lib/auth-client.ts` (client); rota em `src/routes/api/auth/$.ts`
- i18n: mensagens em `messages/{pt-BR,en}.json`; use `m.chave()` de `#/paraglide/messages`; nunca hardcode texto de UI
- UI: componentes shadcn em `src/components/ui`; para adicionar novos em ambiente com proxy restrito, copie do registry no GitHub (`shadcn-ui/ui`, `apps/v4/registry/new-york-v4/ui`) trocando `@/` por `#/`
- Antes de commitar: `pnpm lint`, `npx tsc --noEmit` e `pnpm build` devem passar
