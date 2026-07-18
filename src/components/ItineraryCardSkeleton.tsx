import { Card, CardContent, CardFooter, CardHeader } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import { m } from '#/paraglide/messages'

/** Branded placeholder for a single `ItineraryCard` while its grid's query is in flight. */
function ItineraryCardSkeleton() {
  return (
    <Card className="gap-3 overflow-hidden py-0">
      <Skeleton className="h-40 w-full rounded-none" />
      <CardHeader className="pt-4">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </CardHeader>
      <CardContent className="flex gap-1.5">
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </CardContent>
      <CardFooter className="mt-auto pb-4">
        <Skeleton className="h-4 w-24" />
      </CardFooter>
    </Card>
  )
}

/**
 * Grid-shaped Suspense fallback for the discovery (`/`) and `/my` result
 * grids — matches the real grid's column layout so the page doesn't
 * jump when data resolves. `count` defaults to a full page's worth so it
 * reads as "a page of results loading," not a couple of stray cards.
 */
export function ItineraryGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-label={m.app_loading()}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: count }, (_, index) => (
        <ItineraryCardSkeleton key={index} />
      ))}
    </div>
  )
}
