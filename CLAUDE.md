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
   - Better Auth → `better-auth-best-practices`, `create-auth`, `email-and-password-best-practices`, `better-auth-security-best-practices` skills (official, from `better-auth/skills`)
   - Email (Resend) → `resend`, `react-email`, `email-best-practices` skills (official, from `resend/resend-skills`)
2. **No skill? Use Context7.** For libraries without an installed skill — **Drizzle ORM, Paraglide/inlang, TanStack Query, TanStack Form, Tailwind, Zod, Vitest** — look up current docs through the `context7` MCP (configured in `.mcp.json`) before implementing. Do not rely on training knowledge alone for these libraries' APIs.
3. If Context7 is unreachable (restricted proxy), consult the library's official GitHub repository (raw.githubusercontent.com is usually allowed).

## Project conventions

- Import alias: `#/` → `src/` (e.g. `#/components/ui/button`)
- Database schema: tables live in `src/db/`, always re-exported by `src/db/schema.ts`; migrations via `pnpm db:generate` + `pnpm db:migrate`
- Auth: configured in `src/lib/auth.ts` (server) and `src/lib/auth-client.ts` (client); route at `src/routes/api/auth/$.ts`
- i18n: messages in `messages/{pt-BR,en}.json`; use `m.key()` from `#/paraglide/messages`; never hardcode UI copy
- UI: shadcn components in `src/components/ui`; to add new ones in a restricted-proxy environment, copy from the GitHub registry (`shadcn-ui/ui`, `apps/v4/registry/new-york-v4/ui`) replacing `@/` with `#/`
- Before committing: `pnpm lint`, `npx tsc --noEmit`, and `pnpm build` must pass
- Workflow: every task gets its own branch and PR
- Function params: >3 params, or 2+ consecutive same-typed params, become a single named options object; exception: the server `*Impl(db, session, input)` trio stays positional

## Design Context

Before any UI work, read `PRODUCT.md` (register, users, positioning, anti-references) and `DESIGN.md` (colors, typography, elevation, components) — both are the source of truth for the **"Trilha Tropical"** direction: deep mata-green brand voice, amber scoped to stars + the drawn route, coral scoped to the favorite heart, warm cream paper with bright floating cards, Fraunces for content titles only, Karla everywhere else, mobile-native bottom-tab navigation, and the drawn-route signature (map route line ↔ RouteSketch placeholder ↔ numbered timeline). `.interface-design/system.md` mirrors the same concrete tokens for the `interface-design` skill and is kept in sync with `src/styles.css` — the shipped app implements this system.
