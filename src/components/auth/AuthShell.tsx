import { CompassIcon } from 'lucide-react'

import { m } from '#/paraglide/messages'

/**
 * Shared "front door" shell for `/login` and `/signup`. Both routes wrap a
 * form (`LoginForm` / `SignupForm`) in this component instead of a generic
 * `ui/card` — DESIGN.md's brief for these two pages explicitly asks for a
 * brand moment (wordmark + compass motif, Fraunces as a deliberate one-off
 * brand-title exception to the Editorial Title Rule, which otherwise
 * reserves Fraunces for itinerary/day content) and "no giant empty card" on
 * desktop, so there's no `Card`/shadow surface here at all — the form sits
 * directly on the page's `paper` background inside a narrow centered
 * column, full-height on mobile so the keyboard has room to open without
 * the brand moment scrolling out of view.
 */
export function AuthShell({
  welcome,
  children,
  footer,
}: {
  welcome: string
  children: React.ReactNode
  footer: React.ReactNode
}) {
  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col items-center justify-center px-4 py-10 sm:px-6">
      <div className="w-full max-w-[400px] animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span
            aria-hidden="true"
            className="flex size-12 items-center justify-center rounded-full bg-terracotta-soft text-terracotta"
          >
            <CompassIcon className="size-6" strokeWidth={1.75} />
          </span>
          <h1 className="font-display text-display text-ink">
            {m.app_name()}
          </h1>
          <p className="text-body text-ink-soft">{welcome}</p>
        </div>

        {children}

        <div className="mt-6 text-center">{footer}</div>
      </div>
    </div>
  )
}
