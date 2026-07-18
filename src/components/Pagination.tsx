import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { m } from '#/paraglide/messages'

/**
 * Shared prev/next pager for the two paginated grids (`/` discovery and
 * `/my` mine/favorites). Purely presentational — the caller owns how a
 * page change is applied (nuqs on the home route, `Route.useNavigate` on
 * `/my`), it just renders state and forwards clicks.
 */
export function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}) {
  return (
    <div className="flex items-center justify-between border-t border-line pt-4">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeftIcon data-icon="inline-start" />
        {m.home_page_previous()}
      </Button>
      <span className="text-label font-medium tabular-nums text-ink-soft">
        {m.home_page_status({ page, totalPages })}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        {m.home_page_next()}
        <ChevronRightIcon data-icon="inline-end" />
      </Button>
    </div>
  )
}
