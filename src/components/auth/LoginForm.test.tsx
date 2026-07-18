// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

import { LoginForm } from './LoginForm'

const signInEmail = vi.hoisted(() => vi.fn())

vi.mock('#/lib/auth-client', () => ({
  authClient: {
    signIn: { email: signInEmail },
  },
}))

afterEach(() => {
  cleanup()
  signInEmail.mockReset()
})

/** Renders with a fresh `QueryClient` — `LoginForm` invalidates the session query on success. */
function renderLoginForm(onSuccess: () => void) {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <LoginForm onSuccess={onSuccess} />
    </QueryClientProvider>,
  )
}

describe('LoginForm', () => {
  it('renders the email and password fields and a submit button', () => {
    renderLoginForm(vi.fn())

    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /entrar/i }),
    ).toBeInTheDocument()
  })

  it('shows validation errors and does not call signIn.email on empty submit', async () => {
    const user = userEvent.setup()
    renderLoginForm(vi.fn())

    await user.click(screen.getByRole('button', { name: /entrar/i }))

    await waitFor(() => {
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0)
    })
    expect(signInEmail).not.toHaveBeenCalled()
  })

  it('calls authClient.signIn.email with the typed values and invokes onSuccess', async () => {
    signInEmail.mockImplementation(async (_credentials, options) => {
      options?.onSuccess?.()
    })
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    renderLoginForm(onSuccess)

    await user.type(screen.getByLabelText(/e-mail/i), 'jane@example.com')
    await user.type(screen.getByLabelText(/senha/i), 'correct-horse-battery')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    await waitFor(() => {
      expect(signInEmail).toHaveBeenCalledTimes(1)
    })
    expect(signInEmail).toHaveBeenCalledWith(
      { email: 'jane@example.com', password: 'correct-horse-battery' },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    )
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })
})
