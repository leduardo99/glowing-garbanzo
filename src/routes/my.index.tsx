import { z } from 'zod'
import { useSuspenseQuery } from '@tanstack/react-query'
import {
  Link,
  createFileRoute,
  redirect,
} from '@tanstack/react-router'
import { ChevronLeftIcon, ChevronRightIcon, MapIcon } from 'lucide-react'

import { ItineraryCard } from '#/components/ItineraryCard'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from '#/components/ui/empty'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { myFavoritesQueryOptions, myItinerariesQueryOptions } from '#/lib/queries'
import { m } from '#/paraglide/messages'
import { PAGE_SIZE } from '#/server/itineraries'
import type { MyItineraryCard } from '#/server/itineraries'

const mySearchSchema = z.object({
  tab: z.enum(['mine', 'favorites']).default('mine'),
  page: z.number().int().min(1).default(1),
})

export const Route = createFileRoute('/my/')({
  validateSearch: mySearchSchema,
  beforeLoad: ({ context, location }) => {
    if (!context.session) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
  },
  loaderDeps: ({ search }) => ({ tab: search.tab, page: search.page }),
  loader: async ({ context, deps }) => {
    if (deps.tab === 'mine') {
      await context.queryClient.ensureQueryData(
        myItinerariesQueryOptions({ page: deps.page }),
      )
    } else {
      await context.queryClient.ensureQueryData(
        myFavoritesQueryOptions({ page: deps.page }),
      )
    }
  },
  component: MyItinerariesPage,
})

function MyItinerariesPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{m.myitineraries_title()}</h1>
        <Button asChild size="sm">
          <Link to="/new">{m.nav_new_itinerary()}</Link>
        </Button>
      </div>

      <Tabs
        value={search.tab}
        onValueChange={(value) =>
          void navigate({
            search: { tab: value as 'mine' | 'favorites', page: 1 },
          })
        }
      >
        <TabsList>
          <TabsTrigger value="mine">{m.myitineraries_tab_mine()}</TabsTrigger>
          <TabsTrigger value="favorites">
            {m.myitineraries_tab_favorites()}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {search.tab === 'mine' ? (
        <MineTab page={search.page} />
      ) : (
        <FavoritesTab page={search.page} />
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: MyItineraryCard['status'] }) {
  return (
    <Badge
      variant={status === 'draft' ? 'secondary' : 'default'}
      className="absolute top-2 left-2"
    >
      {status === 'draft'
        ? m.myitineraries_status_draft()
        : m.myitineraries_status_published()}
    </Badge>
  )
}

function Pagination({ page, total }: { page: number; total: number }) {
  const navigate = Route.useNavigate()
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="flex items-center justify-between">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() =>
          void navigate({ search: (prev) => ({ ...prev, page: page - 1 }) })
        }
      >
        <ChevronLeftIcon data-icon="inline-start" />
        {m.home_page_previous()}
      </Button>
      <span className="text-sm text-muted-foreground">
        {m.home_page_status({ page, totalPages })}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() =>
          void navigate({ search: (prev) => ({ ...prev, page: page + 1 }) })
        }
      >
        {m.home_page_next()}
        <ChevronRightIcon data-icon="inline-end" />
      </Button>
    </div>
  )
}

function MineTab({ page }: { page: number }) {
  const { data } = useSuspenseQuery(myItinerariesQueryOptions({ page }))

  if (data.items.length === 0) {
    return (
      <Empty>
        <EmptyMedia variant="icon">
          <MapIcon />
        </EmptyMedia>
        <EmptyTitle>{m.myitineraries_empty_mine()}</EmptyTitle>
        <EmptyDescription>
          {m.myitineraries_empty_mine_description()}
        </EmptyDescription>
        <Button asChild size="sm">
          <Link to="/new">{m.myitineraries_empty_mine_cta()}</Link>
        </Button>
      </Empty>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.items.map((item) => (
          <Link key={item.id} to="/my/$id/edit" params={{ id: item.id }}>
            <div className="relative">
              <ItineraryCard item={item} />
              <StatusBadge status={item.status} />
            </div>
          </Link>
        ))}
      </div>
      <Pagination page={page} total={data.total} />
    </>
  )
}

function FavoritesTab({ page }: { page: number }) {
  const { data } = useSuspenseQuery(myFavoritesQueryOptions({ page }))

  if (data.items.length === 0) {
    return (
      <Empty>
        <EmptyMedia variant="icon">
          <MapIcon />
        </EmptyMedia>
        <EmptyTitle>{m.myitineraries_empty_favorites()}</EmptyTitle>
        <EmptyDescription>
          {m.myitineraries_empty_favorites_description()}
        </EmptyDescription>
      </Empty>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.items.map((item) => (
          <Link key={item.id} to="/itineraries/$slug" params={{ slug: item.slug }}>
            <ItineraryCard item={item} />
          </Link>
        ))}
      </div>
      <Pagination page={page} total={data.total} />
    </>
  )
}
