import { Suspense, useEffect, useState } from 'react'
import { z } from 'zod'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { SearchIcon, SlidersHorizontalIcon, XIcon } from 'lucide-react'
import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringEnum,
  useQueryStates,
} from 'nuqs'

import { ItineraryCard } from '#/components/ItineraryCard'
import { ItineraryGridSkeleton } from '#/components/ItineraryCardSkeleton'
import { Pagination } from '#/components/Pagination'
import { RouteSketch } from '#/components/RouteSketch'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '#/components/ui/drawer'
import {
  Empty,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from '#/components/ui/empty'
import { Field, FieldGroup, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { cn } from '#/lib/utils'
import { searchQueryOptions } from '#/lib/queries'
import { m } from '#/paraglide/messages'
import { PAGE_SIZE } from '#/server/itineraries'
import type { SearchItinerariesInput } from '#/server/itineraries'

type DurationBucket = 'any' | 'short' | 'medium' | 'long'
type SortOption = 'recent' | 'top'

const DURATION_VALUES = ['any', 'short', 'medium', 'long'] as const
const SORT_VALUES = ['recent', 'top'] as const

const DURATION_LABEL: Record<DurationBucket, () => string> = {
  any: m.home_duration_any,
  short: m.home_duration_short,
  medium: m.home_duration_medium,
  long: m.home_duration_long,
}

/** Duration-select buckets → the `minDays`/`maxDays` range `searchItineraries` expects. */
const DURATION_BOUNDS: Record<
  DurationBucket,
  { minDays?: number; maxDays?: number }
> = {
  any: {},
  short: { minDays: 1, maxDays: 3 },
  medium: { minDays: 4, maxDays: 7 },
  long: { minDays: 8 },
}

/**
 * Rounded, pill-shaped filter chip — the horizontally scrollable row's one
 * visual unit, shared by the duration buckets, active tag chips, and the
 * "Filtros" sheet trigger. Selected state flips to mata-soft/
 * mata text (DESIGN.md's Chips/Tags spec); unselected chips stay on
 * surface-sunken so the row reads as calm until something's active.
 */
function filterChipClassName(selected: boolean) {
  return cn(
    'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-label font-medium whitespace-nowrap transition-colors',
    selected
      ? 'bg-mata-soft text-mata-soft-foreground'
      : 'bg-surface-sunken text-ink-soft hover:text-ink',
  )
}

/**
 * Search filters, normalized (tags already split into an array — see the
 * `homeSearchSchema`/nuqs reconciliation note below) → the shape
 * `searchItineraries` expects.
 */
function toSearchInput(search: {
  q?: string
  tags: string[]
  duration: DurationBucket
  sort: SortOption
  page: number
}): SearchItinerariesInput {
  const { minDays, maxDays } = DURATION_BOUNDS[search.duration]
  return {
    q: search.q,
    tags: search.tags.length > 0 ? search.tags : undefined,
    minDays,
    maxDays,
    sort: search.sort,
    page: search.page,
  }
}

/** Splits the route's comma-joined `tags` search param into a tag list. */
function parseTagsParam(tags?: string): string[] {
  if (!tags) return []
  return tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

/**
 * Route-level search schema — this is the *loader's* contract (SSR
 * `ensureQueryData`, `beforeLoad`/`loaderDeps` typing), kept as
 * `validateSearch` per TanStack Router convention. The interactive side
 * (below, in `HomePage`) uses nuqs (`useQueryStates`) instead of
 * `Route.useSearch()`/`Route.useNavigate()` for typed parsing, keystroke
 * debouncing, and default-clearing — both read the same underlying router
 * search state, so they can't drift.
 *
 * `tags` is a single comma-joined string here, not an array: TanStack
 * Router's default search serializer JSON-encodes non-primitive values
 * (`tags=%5B%22a%22%5D`), which doesn't round-trip through nuqs's own
 * comma-joined array serialization (`tags=a,b`) — writes from nuqs would
 * come back from the router as a string nuqs can't re-parse as an array.
 * Keeping the wire format a plain string sidesteps that mismatch; nuqs
 * (`parseAsArrayOf`) and `parseTagsParam` below both split on the same
 * separator, so the two stay equivalent.
 */
const homeSearchSchema = z.object({
  q: z.string().optional(),
  tags: z.string().optional(),
  duration: z.enum(DURATION_VALUES).default('any'),
  sort: z.enum(SORT_VALUES).default('recent'),
  page: z.number().int().min(1).default(1),
})

export const Route = createFileRoute('/explore')({
  validateSearch: homeSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps, context }) => {
    await context.queryClient.ensureQueryData(
      searchQueryOptions(
        toSearchInput({ ...deps, tags: parseTagsParam(deps.tags) }),
      ),
    )
  },
  component: HomePage,
})

const homeQueryParsers = {
  q: parseAsString.withDefault(''),
  tags: parseAsArrayOf(parseAsString).withDefault([]),
  duration: parseAsStringEnum([...DURATION_VALUES]).withDefault('any'),
  sort: parseAsStringEnum([...SORT_VALUES]).withDefault('recent'),
  page: parseAsInteger.withDefault(1),
}

/** Debounces a fast-changing value (keystrokes) before it drives a network request. */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])
  return debounced
}

function HomePage() {
  // Every filter change but the search box pushes a new history entry
  // (back/forward steps through filter changes one at a time, matching
  // the pre-nuqs behavior); the debounced search box below overrides this
  // to `replace` per-call so mid-typing keystrokes don't spam history.
  const [query, setQuery] = useQueryStates(homeQueryParsers, {
    history: 'push',
  })

  // Search input: typing updates local state immediately (responsive UI);
  // the URL search param (and thus the query) only updates once the value
  // settles, so we don't fire a request per keystroke.
  const [draftQuery, setDraftQuery] = useState(query.q)
  const debouncedQuery = useDebouncedValue(draftQuery, 300)
  useEffect(() => {
    if (debouncedQuery === query.q) return
    void setQuery(
      { q: debouncedQuery || null, page: 1 },
      { history: 'replace' },
    )
  }, [debouncedQuery, query.q, setQuery])

  const [tagDraft, setTagDraft] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)

  function addTag() {
    const trimmed = tagDraft.trim()
    setTagDraft('')
    if (!trimmed || query.tags.includes(trimmed)) return
    void setQuery({ tags: [...query.tags, trimmed], page: 1 })
  }

  function removeTag(tag: string) {
    void setQuery({ tags: query.tags.filter((t) => t !== tag), page: 1 })
  }

  function clearFilters() {
    void setQuery({ tags: [], duration: 'any' })
  }

  const hasActiveFilters = query.duration !== 'any' || query.tags.length > 0

  const searchField = (
    <div className="relative">
      <SearchIcon
        data-icon="inline-start"
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-ink-soft"
      />
      <Input
        id="home-search-mobile"
        aria-label={m.home_search_placeholder()}
        className="h-11 rounded-full border-transparent bg-surface-sunken pl-10 shadow-none focus-visible:border-mata"
        placeholder={m.home_search_placeholder()}
        value={draftQuery}
        onChange={(event) => setDraftQuery(event.target.value)}
      />
    </div>
  )

  const sortControl = (
    <Tabs
      value={query.sort}
      onValueChange={(value) =>
        void setQuery({ sort: value as SortOption, page: 1 })
      }
    >
      <TabsList>
        <TabsTrigger value="recent">{m.home_sort_recent()}</TabsTrigger>
        <TabsTrigger value="top">{m.home_sort_top()}</TabsTrigger>
      </TabsList>
    </Tabs>
  )

  // Rendered once in the desktop inline form and once inside the mobile
  // sheet — both can be simultaneously present in the DOM (the desktop
  // section is only `display:none` below `md`, not unmounted), so the
  // input id must vary per call site to stay unique/valid.
  function renderTagsField(idSuffix: string) {
    const inputId = `home-tags-${idSuffix}`
    return (
      <Field>
        <FieldLabel htmlFor={inputId}>{m.home_filter_tags()}</FieldLabel>
        <Input
          id={inputId}
          placeholder={m.home_filter_tags_placeholder()}
          value={tagDraft}
          onChange={(event) => setTagDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              addTag()
            }
          }}
        />
        {query.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {query.tags.map((tag) => (
              <Badge key={tag} variant="tag" className="gap-1">
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  aria-label={m.home_filter_tag_remove({ tag })}
                  className="cursor-pointer"
                >
                  <XIcon className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        ) : null}
      </Field>
    )
  }

  return (
    <div className="flex flex-col">
      {/*
        Mobile compact sticky top (<md): one prominent rounded search field
        plus the horizontally scrollable chip row below it. Sticks under
        AppHeader's wordmark bar once that scrolls past — the app-grade
        "search stays put" pattern (Uber Eats/Glovo), replacing the old
        stacked label/field form entirely on small screens.
      */}
      <div className="sticky top-0 z-30 flex flex-col gap-3 border-b border-line bg-paper/95 px-4 pt-3 pb-3 backdrop-blur-sm md:hidden">
        {searchField}

        <div
          role="group"
          aria-label={m.home_filters_button()}
          className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4"
        >
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            aria-label={m.home_filters_button()}
            className={cn(
              filterChipClassName(hasActiveFilters),
              'gap-1.5 border border-line-strong',
            )}
          >
            <SlidersHorizontalIcon aria-hidden="true" className="size-3.5" />
            {m.home_filters_button()}
            {hasActiveFilters ? (
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-mata"
              />
            ) : null}
          </button>

          {DURATION_VALUES.map((bucket) => (
            <button
              key={bucket}
              type="button"
              onClick={() =>
                void setQuery({
                  duration: query.duration === bucket ? 'any' : bucket,
                  page: 1,
                })
              }
              className={filterChipClassName(query.duration === bucket)}
            >
              {DURATION_LABEL[bucket]()}
            </button>
          ))}

          {query.tags.map((tag) => (
            <span key={tag} className={filterChipClassName(true)}>
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                aria-label={m.home_filter_tag_remove({ tag })}
                className="cursor-pointer"
              >
                <XIcon className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:gap-8 sm:p-6">
        {/* Mobile: compact hero, the search bar above already carries the
            primary action so this stays short. */}
        <div className="flex flex-col gap-1 pt-1 md:hidden">
          {/* Same one-off Fraunces brand moment as the desktop hero. */}
          <h1 className="font-display text-headline text-ink">
            {m.home_hero_title()}
          </h1>
          <p className="text-label text-ink-soft">{m.home_hero_subtitle()}</p>
        </div>

        {/* Desktop (md+): unchanged stacked hero + inline filter form. */}
        <section className="hidden flex-col gap-6 py-4 md:flex sm:py-8">
          <div className="flex flex-col gap-2">
            {/* Brand moment: like the auth pages, the discovery hero is a
                deliberate one-off Fraunces exception to the Editorial
                Title Rule — the "magazine cover" of the app. */}
            <h1 className="max-w-2xl font-display text-display text-ink">
              {m.home_hero_title()}
            </h1>
            <p className="measure-prose text-body text-ink-soft">
              {m.home_hero_subtitle()}
            </p>
          </div>

          <FieldGroup className="gap-4 sm:flex-row sm:items-end">
            <Field className="sm:max-w-xs">
              <FieldLabel htmlFor="home-search">
                {m.home_search_placeholder()}
              </FieldLabel>
              <div className="relative">
                <SearchIcon
                  data-icon="inline-start"
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-soft"
                />
                <Input
                  id="home-search"
                  className="pl-9"
                  placeholder={m.home_search_placeholder()}
                  value={draftQuery}
                  onChange={(event) => setDraftQuery(event.target.value)}
                />
              </div>
            </Field>

            <Field className="sm:max-w-56">
              <FieldLabel htmlFor="home-duration">
                {m.home_filter_duration()}
              </FieldLabel>
              <Select
                value={query.duration}
                onValueChange={(value) =>
                  void setQuery({ duration: value as DurationBucket, page: 1 })
                }
              >
                <SelectTrigger id="home-duration" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_VALUES.map((bucket) => (
                    <SelectItem key={bucket} value={bucket}>
                      {DURATION_LABEL[bucket]()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="sm:max-w-xs">{renderTagsField('desktop')}</div>
          </FieldGroup>

          {sortControl}
        </section>

        <Suspense fallback={<ItineraryGridSkeleton />}>
          <SearchResults
            query={query}
            onPageChange={(page) => void setQuery({ page })}
          />
        </Suspense>
      </div>

      {/*
        Mobile "Filtros" bottom sheet — the full control set (tags input,
        duration select, sort segmented control) that the chip row above
        only surfaces shortcuts for. Desktop never opens this (its trigger
        is `md:hidden`), so the Drawer stays mounted-but-inert there.
      */}
      <Drawer open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{m.home_filters_button()}</DrawerTitle>
          </DrawerHeader>

          <div className="flex flex-col gap-5 overflow-y-auto px-4 pb-4">
            {renderTagsField('sheet')}

            <Field>
              <FieldLabel htmlFor="home-duration-sheet">
                {m.home_filter_duration()}
              </FieldLabel>
              <Select
                value={query.duration}
                onValueChange={(value) =>
                  void setQuery({ duration: value as DurationBucket, page: 1 })
                }
              >
                <SelectTrigger id="home-duration-sheet" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_VALUES.map((bucket) => (
                    <SelectItem key={bucket} value={bucket}>
                      {DURATION_LABEL[bucket]()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>{m.home_sort_label()}</FieldLabel>
              {sortControl}
            </Field>
          </div>

          <DrawerFooter>
            <Button onClick={() => setFiltersOpen(false)}>
              {m.home_filters_show_results()}
            </Button>
            {hasActiveFilters ? (
              <Button variant="ghost" onClick={clearFilters}>
                {m.home_filters_clear()}
              </Button>
            ) : null}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  )
}

function SearchResults({
  query,
  onPageChange,
}: {
  query: {
    q: string
    tags: string[]
    duration: DurationBucket
    sort: SortOption
    page: number
  }
  onPageChange: (page: number) => void
}) {
  const { data } = useSuspenseQuery(searchQueryOptions(toSearchInput(query)))
  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE))

  if (data.items.length === 0) {
    return (
      <Empty>
        <EmptyMedia>
          <RouteSketch seed="home-empty" stops={3} className="h-16 w-40 opacity-70" />
        </EmptyMedia>
        <EmptyTitle>{m.home_empty()}</EmptyTitle>
        <EmptyDescription>{m.home_empty_description()}</EmptyDescription>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {data.items.map((item) => (
          <Link
            key={item.id}
            to="/itineraries/$slug"
            params={{ slug: item.slug }}
            viewTransition={{ types: ['nav-forward'] }}
          >
            <ItineraryCard item={item} />
          </Link>
        ))}
      </div>

      <Pagination
        page={query.page}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
    </div>
  )
}
