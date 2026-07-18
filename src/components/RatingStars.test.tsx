// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

import { RatingStars } from './RatingStars'

const rateItinerary = vi.hoisted(() => vi.fn())

vi.mock('#/server/engagement', () => ({
  rateItinerary: rateItinerary,
}))

// `RatingStars` routes UNAUTHORIZED errors to `/login` via
// `useMutationErrorHandler`, which itself calls the router's `useNavigate`.
// Mocking the hook keeps this test focused on the rating widget's own
// behavior instead of standing up a full router just to satisfy that call.
vi.mock('#/lib/mutation-errors', () => ({
  useMutationErrorHandler: () => (_error: unknown, onOtherError: () => void) =>
    onOtherError(),
}))

afterEach(() => {
  cleanup()
  rateItinerary.mockReset()
})

function renderRatingStars(props: Partial<React.ComponentProps<typeof RatingStars>> = {}) {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <RatingStars
        itineraryId="it_1"
        slug="chapada-diamantina-abc123"
        ratingAvg={4.5}
        ratingCount={12}
        myStars={null}
        canRate={true}
        redirectTarget="/itineraries/chapada-diamantina-abc123"
        {...props}
      />
    </QueryClientProvider>,
  )
}

describe('RatingStars', () => {
  it('renders the average and rating count', () => {
    renderRatingStars({ ratingAvg: 4.5, ratingCount: 12 })

    expect(screen.getByText(/4\.5/)).toBeInTheDocument()
    expect(screen.getByText(/12/)).toBeInTheDocument()
  })

  it('shows the no-ratings placeholder when nothing has been rated yet', () => {
    renderRatingStars({ ratingAvg: null, ratingCount: 0 })

    expect(screen.queryByText(/4\.5/)).not.toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(5)
  })

  it('submits the clicked star count when rating is allowed', async () => {
    rateItinerary.mockResolvedValue({ ratingAvg: 4.7, ratingCount: 13 })
    const user = userEvent.setup()
    renderRatingStars({ itineraryId: 'it_42', canRate: true })

    const stars = screen.getAllByRole('radio')
    expect(stars).toHaveLength(5)
    await user.click(stars[3])

    await waitFor(() => {
      expect(rateItinerary).toHaveBeenCalledTimes(1)
    })
    expect(rateItinerary).toHaveBeenCalledWith({
      data: { id: 'it_42', stars: 4 },
    })
  })

  it('renders read-only stars with no clickable controls when rating is not allowed', () => {
    renderRatingStars({ canRate: false, myStars: null, ratingAvg: 3, ratingCount: 2 })

    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(rateItinerary).not.toHaveBeenCalled()
  })
})
