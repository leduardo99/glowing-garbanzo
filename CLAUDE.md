# Roteiros — agent guide

Shared travel itineraries app. Stack: TanStack Start (React 19), shadcn/ui, Drizzle + Postgres, Better Auth, Paraglide (i18n pt-BR/en), TanStack Query/Form, Tailwind v4.

@AGENTS.md

## Language convention

**Everything is written in English**: routes, code, identifiers, database schema, comments, docs, commits, and PRs. Portuguese (pt-BR) exists ONLY as a site UI language, delivered through Paraglide messages (`messages/pt-BR.json`). Never hardcode UI copy in any language — always go through `m.*` messages.

## Documentation and best-practices policy

Always follow the involved library's best practices BEFORE writing code:

1. **Skill first.** If an installed skill covers the task, use it:
   - TanStack libraries (Router, Start, Devtools) → TanStack Intent mappings in `AGENTS.md` (run the indicated `load` command)
   - shadcn/ui → `shadcn` skill (`.claude/skills/shadcn`)
   - React/UI patterns → `vercel-react-best-practices`, `vercel-composition-patterns`, `web-design-guidelines` skills
2. **No skill? Use Context7.** For libraries without an installed skill — **Better Auth, Drizzle ORM, Paraglide/inlang, TanStack Query, TanStack Form, Tailwind, Zod, Vitest** — look up current docs through the `context7` MCP (configured in `.mcp.json`) before implementing. Do not rely on training knowledge alone for these libraries' APIs.
3. If Context7 is unreachable (restricted proxy), consult the library's official GitHub repository (raw.githubusercontent.com is usually allowed).

## Project conventions

- Import alias: `#/` → `src/` (e.g. `#/components/ui/button`)
- Database schema: tables live in `src/db/`, always re-exported by `src/db/schema.ts`; migrations via `pnpm db:generate` + `pnpm db:migrate`
- Auth: configured in `src/lib/auth.ts` (server) and `src/lib/auth-client.ts` (client); route at `src/routes/api/auth/$.ts`
- i18n: messages in `messages/{pt-BR,en}.json`; use `m.key()` from `#/paraglide/messages`; never hardcode UI copy
- UI: shadcn components in `src/components/ui`; to add new ones in a restricted-proxy environment, copy from the GitHub registry (`shadcn-ui/ui`, `apps/v4/registry/new-york-v4/ui`) replacing `@/` with `#/`
- Before committing: `pnpm lint`, `npx tsc --noEmit`, and `pnpm build` must pass
- Workflow: every task gets its own branch and PR
