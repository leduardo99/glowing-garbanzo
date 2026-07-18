# Design: domínio de roteiros de viagem compartilhados

Data: 2026-07-18
Status: aprovado (brainstorming com o usuário em 2026-07-18)

## Visão

Plataforma de comunidade para **publicar e descobrir roteiros de viagem**. Autores criam roteiros estruturados em dias e paradas; leitores descobrem, salvam, avaliam, comentam e copiam (fork) roteiros para adaptar às próprias viagens. Roteiros também podem ser **privados**, acessíveis apenas a membros convidados por link.

Decisões de produto tomadas no brainstorming:

- Caso de uso central: **publicar para a comunidade** (não é ferramenta de planejamento colaborativo em tempo real).
- Estrutura: **dias → paradas ordenadas**, sem horários por parada.
- Interações do MVP: **salvar/favoritar, fork, avaliar (estrelas), comentar**.
- Descoberta: **destino (texto livre) + tags de estilo**, busca por texto, filtro por tags/duração.
- Ciclo de vida: **rascunho → publicado** (sem estado "não listado"; privacidade cobre esse caso).
- Mídia: **foto de capa + mapa das paradas** (MapLibre + geocoding Nominatim, pin ajustável).
- Privacidade: roteiro **público ou privado**; privado acessível só ao autor e membros convidados via **link com token** (sem e-mail no MVP).

Decisões de arquitetura:

- Dados via **server functions do TanStack Start** (`createServerFn` + Zod) consumidas com **TanStack Query**. Sem camada RPC extra.
- **MapLibre GL** para mapas e **Nominatim (OSM)** para busca de lugar, com pin arrastável; coordenadas persistidas no banco. Sem API key.

## Modelo de domínio (Drizzle / Postgres)

Todas as tabelas novas ficam em `src/db/` e são re-exportadas por `src/db/schema.ts`. FKs para usuário referenciam a tabela `user` do Better Auth (`src/db/auth-schema.ts`).

### `itinerary`

| Campo | Tipo | Notas |
| --- | --- | --- |
| `id` | text (nanoid) | PK |
| `authorId` | text → `user.id` | not null, on delete cascade |
| `title` | text | not null |
| `slug` | text | único; gerado do título + sufixo curto aleatório; imutável após criação |
| `summary` | text | descrição curta para cards e cabeçalho |
| `destination` | text | destino principal, texto livre ("Chapada Diamantina, BA") |
| `tags` | text[] | tags de estilo (aventura, gastronomia, barato, família…) |
| `coverImageUrl` | text nullable | URL da capa (servida pela rota de uploads) |
| `status` | enum `draft` \| `published` | rascunho só o autor vê |
| `visibility` | enum `public` \| `private` | privado: fora da descoberta, acesso só autor + membros |
| `inviteToken` | text nullable | token do link-convite de roteiros privados; regenerável (revoga o anterior) |
| `forkedFromId` | text nullable → `itinerary.id` | crédito ao original; on delete set null |
| `ratingAvg` | numeric nullable | denormalizado; atualizado a cada avaliação |
| `ratingCount` | integer default 0 | denormalizado |
| `publishedAt` | timestamp nullable | |
| `createdAt` / `updatedAt` | timestamp | |

### `itinerary_day`

`id`, `itineraryId` (FK cascade), `dayNumber` (1..n, único por roteiro), `title?`, `note?`. A duração do roteiro é o número de dias.

### `stop`

`id`, `dayId` (FK cascade), `position` (ordem no dia), `name` (not null), `category` (enum: `attraction` | `food` | `lodging` | `transport` | `other`), `description?` (dica do autor), `costCents?` (integer, BRL no MVP), `lat?` / `lng?` (double), `placeLabel?` (endereço retornado pelo Nominatim). Parada pode existir sem pin (geocoding é opcional).

### `favorite`

PK composta (`userId`, `itineraryId`), `createdAt`. FKs cascade.

### `rating`

PK composta (`userId`, `itineraryId`), `stars` (1–5), `createdAt`, `updatedAt`. Upsert por usuário; cada mutação recalcula `ratingAvg`/`ratingCount` do roteiro na mesma transação. Só permitida em roteiros públicos publicados.

### `comment`

`id`, `itineraryId` (FK cascade), `authorId` (FK), `body` (not null), `createdAt`. Hard delete pelo próprio autor do comentário. Sem threads/moderação no MVP.

### `itinerary_member`

PK composta (`itineraryId`, `userId`), `createdAt`. Preenchida quando um usuário logado abre um link-convite válido. Membros de roteiro privado: leem, comentam, favoritam e fazem fork. Autor lista e remove membros.

## Permissões

Checadas **sempre no servidor**, dentro das server functions:

| Ação | Quem pode |
| --- | --- |
| Ver roteiro | público+publicado: qualquer um (até deslogado). Privado+publicado: autor e membros. Rascunho: só autor |
| Criar / editar / publicar / despublicar / apagar | só o autor |
| Gerar/revogar link-convite, remover membro | só o autor (apenas roteiros privados) |
| Fork | logado com acesso de leitura ao roteiro; cria cópia completa (dias+paradas) como rascunho do usuário, com `forkedFromId` |
| Favoritar / comentar | logado com acesso de leitura |
| Avaliar | logado; somente roteiros públicos publicados; 1 avaliação por usuário (upsert) |

## Rotas (TanStack Router, file-based)

| Rota | Conteúdo |
| --- | --- |
| `/` | Descoberta: busca por texto (título/destino/resumo, ILIKE), filtros por tags e duração, ordenação por recentes ou melhor avaliados; cards (capa, destino, nº de dias, nota) |
| `/roteiros/$slug` | Visualização: capa, resumo, autor, crédito de fork, dias com paradas, mapa MapLibre com pins, estrelas, favoritar, fork, comentários. Aceita `?convite=<token>` para entrar como membro |
| `/novo` | Cria rascunho e redireciona para o editor |
| `/meus/$id/editar` | Editor: metadados (título, destino, tags, capa, visibilidade), dias e paradas com reordenação, busca Nominatim + pin arrastável, publicar/despublicar, link-convite e membros (se privado) |
| `/meus` | Meus roteiros (rascunhos e publicados) + favoritos |
| `/entrar`, `/cadastro` | Better Auth (email/senha) |

Rotas de servidor: `/api/auth/$` (existente), `/api/uploads/$` (serve arquivos de `UPLOADS_DIR`).

## Server functions

Módulos por domínio em `src/server/`, todos com validação Zod e consumidos via TanStack Query:

- `itineraries.ts` — `searchItineraries` (texto/tags/duração/ordenação, paginado), `getItineraryBySlug` (aplica regra de acesso; aceita token de convite), `createItinerary`, `updateItinerary`, `deleteItinerary`, `publishItinerary`, `unpublishItinerary`, `forkItinerary`
- `days-stops.ts` — CRUD de dias e paradas, `reorderStops`, `moveStopToDay`
- `engagement.ts` — `toggleFavorite`, `rateItinerary`, `addComment`, `deleteComment`, `listComments`
- `members.ts` — `regenerateInviteToken`, `revokeInviteToken`, `joinByInviteToken`, `listMembers`, `removeMember`
- `uploads.ts` — upload da capa (valida tipo/tamanho, grava em `UPLOADS_DIR`, retorna URL)

Geocoding (Nominatim) é chamado **do cliente** no editor (busca de lugar); o servidor apenas persiste `lat`/`lng`/`placeLabel` validados.

## Erros

- Zod em toda server function; erros de formulário retornam campo a campo (TanStack Form).
- Slug inexistente ou sem acesso de leitura → 404 (não vaza existência de roteiro privado).
- Mutação sem sessão → redirect para `/entrar` (com retorno à página de origem).
- Falha de mutação → toast (sonner) com mensagem i18n.
- Nominatim indisponível → editor segue funcionando; pin fica sem preencher (opcional).
- Link-convite inválido/revogado → página explica e oferece pedir novo link ao autor.

## Testes (Vitest)

- **Unidade** (puro, sem IO): geração de slug, recálculo de `ratingAvg`/`ratingCount`, cópia de fork (estrutura dias/paradas), regras de acesso (função `canRead`/`canEdit`).
- **Integração**: server functions contra banco `roteiros_test` com migrations reais — fluxos: criar→publicar→buscar; fork com crédito; convite: gerar link→entrar→revogar→acesso negado; avaliação com upsert e agregados.
- **Componente**: editor de paradas (adicionar/reordenar) e formulário de avaliação.

## Fora de escopo (MVP)

Edição colaborativa em tempo real; convite por e-mail (o modelo de membros já comporta); fotos por parada; taxonomia curada de destinos; página de perfil público do autor; moderação/admin; múltiplas moedas; app mobile; notificações.

## Riscos e mitigações

- **Rate limit do Nominatim** (1 req/s): debounce na busca do editor e header `User-Agent` correto; se virar gargalo, trocar por serviço pago é mudança isolada no componente de busca.
- **Uploads em produção**: `UPLOADS_DIR` em disco pressupõe host com filesystem persistente (Railway/VM). Migração para S3 muda só `uploads.ts` e a rota de serviço.
- **Busca ILIKE** não escala para muito conteúdo: aceitável no MVP; caminho de evolução é `pg_trgm`/tsvector sem mudança de API.
