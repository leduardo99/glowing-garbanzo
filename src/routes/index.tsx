import { useEffect, useState } from 'react'
import { z } from 'zod'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchIcon,
  XIcon,
} from 'lucide-react'

import { ItineraryCard } from '#/components/ItineraryCard'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
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
import { searchQueryOptions } from '#/lib/queries'
import { m } from '#/paraglide/messages'
import { PAGE_SIZE } from '#/server/itineraries'
import type { SearchItinerariesInput } from '#/server/itineraries'

type DurationBucket = 'any' | 'short' | 'medium' | 'long'

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

const homeSearchSchema = z.object({
  q: z.string().optional(),
  tags: z.array(z.string()).optional(),
  duration: z.enum(['any', 'short', 'medium', 'long']).default('any'),
  sort: z.enum(['recent', 'top']).default('recent'),
  page: z.number().int().min(1).default(1),
})

type HomeSearch = z.infer<typeof homeSearchSchema>

function toSearchInput(search: HomeSearch): SearchItinerariesInput {
  const { minDays, maxDays } = DURATION_BOUNDS[search.duration]
  return {
    q: search.q,
    tags: search.tags,
    minDays,
    maxDays,
    sort: search.sort,
    page: search.page,
  }
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

export const Route = createFileRoute('/')({
  validateSearch: homeSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps, context }) => {
    await context.queryClient.ensureQueryData(
      searchQueryOptions(toSearchInput(deps)),
    )
  },
  component: HomePage,
})

function HomePage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data } = useSuspenseQuery(searchQueryOptions(toSearchInput(search)))

  // Search input: typing updates local state immediately (responsive UI);
  // the URL search param (and thus the query) only updates once the value
  // settles, so we don't fire a request per keystroke.
  const [draftQuery, setDraftQuery] = useState(search.q ?? '')
  const debouncedQuery = useDebouncedValue(draftQuery, 300)
  const committedQuery = search.q ?? ''
  useEffect(() => {
    if (debouncedQuery === committedQuery) return
    void navigate({
      search: (prev) => ({ ...prev, q: debouncedQuery || undefined, page: 1 }),
      replace: true,
    })
  }, [debouncedQuery, committedQuery, navigate])

  const [tagDraft, setTagDraft] = useState('')

  function addTag() {
    const trimmed = tagDraft.trim()
    setTagDraft('')
    if (!trimmed || (search.tags ?? []).includes(trimmed)) return
    void navigate({
      search: (prev) => ({
        ...prev,
        tags: [...(prev.tags ?? []), trimmed],
        page: 1,
      }),
    })
  }

  function removeTag(tag: string) {
    void navigate({
      search: (prev) => {
        const next = (prev.tags ?? []).filter((t) => t !== tag)
        return { ...prev, tags: next.length > 0 ? next : undefined, page: 1 }
      },
    })
  }

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE))

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <FieldGroup className="gap-4 sm:flex-row sm:items-end">
        <Field className="sm:max-w-xs">
          <FieldLabel htmlFor="home-search">
            {m.home_search_placeholder()}
          </FieldLabel>
          <div className="relative">
            <SearchIcon
              data-icon="inline-start"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
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
            value={search.duration}
            onValueChange={(value) =>
              void navigate({
                search: (prev) => ({
                  ...prev,
                  duration: value as DurationBucket,
                  page: 1,
                }),
              })
            }
          >
            <SelectTrigger id="home-duration" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{m.home_duration_any()}</SelectItem>
              <SelectItem value="short">{m.home_duration_short()}</SelectItem>
              <SelectItem value="medium">{m.home_duration_medium()}</SelectItem>
              <SelectItem value="long">{m.home_duration_long()}</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field className="sm:max-w-xs">
          <FieldLabel htmlFor="home-tags">{m.home_filter_tags()}</FieldLabel>
          <Input
            id="home-tags"
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
          {search.tags && search.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {search.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1">
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
      </FieldGroup>

      <Tabs
        value={search.sort}
        onValueChange={(value) =>
          void navigate({
            search: (prev) => ({
              ...prev,
              sort: value as HomeSearch['sort'],
              page: 1,
            }),
          })
        }
      >
        <TabsList>
          <TabsTrigger value="recent">{m.home_sort_recent()}</TabsTrigger>
          <TabsTrigger value="top">{m.home_sort_top()}</TabsTrigger>
        </TabsList>
      </Tabs>

      {data.items.length === 0 ? (
        <Empty>
          <EmptyMedia variant="icon">
            <SearchIcon />
          </EmptyMedia>
          <EmptyTitle>{m.home_empty()}</EmptyTitle>
          <EmptyDescription>{m.home_empty_description()}</EmptyDescription>
        </Empty>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((item) => (
              <Link
                key={item.id}
                to="/itineraries/$slug"
                params={{ slug: item.slug }}
              >
                <ItineraryCard item={item} />
              </Link>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              disabled={search.page <= 1}
              onClick={() =>
                void navigate({
                  search: (prev) => ({ ...prev, page: prev.page - 1 }),
                })
              }
            >
              <ChevronLeftIcon data-icon="inline-start" />
              {m.home_page_previous()}
            </Button>
            <span className="text-sm text-muted-foreground">
              {m.home_page_status({ page: search.page, totalPages })}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={search.page >= totalPages}
              onClick={() =>
                void navigate({
                  search: (prev) => ({ ...prev, page: prev.page + 1 }),
                })
              }
            >
              {m.home_page_next()}
              <ChevronRightIcon data-icon="inline-end" />
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
