/**
 * The editor's AI assistant panel (Route Studio phase 4). Lazy-loaded by
 * the editor route so none of this ships to authors who never open it.
 *
 * Conversation lives in component state (no persistence — plan decision).
 * Asking is free; a proposed change renders as a diff card (humanized op
 * list) and only "Aplicar" writes anything — `applyItineraryPatch` runs
 * transactionally server-side and consumes one generation of the daily
 * AI quota, after which every `'itineraries'` query is invalidated so the
 * editor and its live map refresh together.
 *
 * Desktop (lg+): a floating card docked bottom-right over the editor.
 * Mobile: fullscreen takeover (the editor is form-dense; a half sheet
 * would fight the keyboard).
 */
import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2Icon, SendIcon, SparklesIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'
import {
  adviseItineraryChange,
  applyItineraryPatch,
} from '#/server/ai-assistant'
import { getAiAvailability } from '#/server/ai'
import type { AssistantResponse, PatchOp } from '#/server/domain/ai-patch'

interface ChatEntry {
  role: 'user' | 'assistant'
  content: string
  patch?: AssistantResponse['patch']
  /** Set once this entry's patch has been applied (or dismissed). */
  patchResolved?: boolean
}

function opLabel(op: PatchOp): string {
  switch (op.op) {
    case 'set_title':
      return m.assistant_op_set_title()
    case 'set_summary':
      return m.assistant_op_set_summary()
    case 'add_day':
      return m.assistant_op_add_day()
    case 'update_day':
      return m.assistant_op_update_day({ day: op.dayNumber })
    case 'remove_day':
      return m.assistant_op_remove_day({ day: op.dayNumber })
    case 'add_stop':
      return m.assistant_op_add_stop({ day: op.dayNumber, name: op.name })
    case 'update_stop':
      return m.assistant_op_update_stop({
        day: op.dayNumber,
        position: op.position,
      })
    case 'remove_stop':
      return m.assistant_op_remove_stop({
        day: op.dayNumber,
        position: op.position,
      })
  }
}

/** Transcript window sent to the server (its schema caps at 16 entries). */
const TRANSCRIPT_WINDOW = 16

export default function AssistantPanel({
  itineraryId,
  onClose,
}: {
  itineraryId: string
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [entries, setEntries] = useState<ChatEntry[]>([])
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const availability = useQuery({
    queryKey: ['ai', 'availability'],
    queryFn: () => getAiAvailability(),
  })

  function scrollToEnd() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
    })
  }

  const advise = useMutation({
    mutationFn: (nextEntries: ChatEntry[]) =>
      adviseItineraryChange({
        data: {
          itineraryId,
          messages: nextEntries
            .slice(-TRANSCRIPT_WINDOW)
            .map(({ role, content }) => ({ role, content })),
        },
      }),
    onSuccess: (response) => {
      setEntries((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: response.reply,
          patch: response.patch,
        },
      ])
      scrollToEnd()
    },
    onError: () => toast.error(m.assistant_error()),
  })

  const apply = useMutation({
    mutationFn: (ops: PatchOp[]) =>
      applyItineraryPatch({ data: { itineraryId, ops } }),
    onSuccess: (_, __, ___) => {
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'itineraries',
      })
      void queryClient.invalidateQueries({ queryKey: ['ai', 'availability'] })
      toast.success(m.assistant_applied())
    },
    onError: (error) => {
      if (error instanceof Error && error.message.includes('AI_QUOTA_EXCEEDED')) {
        toast.error(m.assistant_quota_error())
        return
      }
      if (error instanceof Error && error.message.includes('AI_PATCH_INVALID')) {
        toast.error(m.assistant_patch_invalid())
        return
      }
      toast.error(m.assistant_error())
    },
  })

  function send() {
    const content = draft.trim()
    if (!content || advise.isPending) {
      return
    }
    setDraft('')
    const next: ChatEntry[] = [...entries, { role: 'user', content }]
    setEntries(next)
    scrollToEnd()
    advise.mutate(next)
  }

  function resolvePatch(index: number, apply_: boolean) {
    const entry = entries[index]
    if (!entry.patch || entry.patchResolved) {
      return
    }
    if (apply_) {
      apply.mutate(entry.patch.ops, {
        onSuccess: () => {
          setEntries((prev) =>
            prev.map((e, i) => (i === index ? { ...e, patchResolved: true } : e)),
          )
        },
      })
    } else {
      setEntries((prev) =>
        prev.map((e, i) => (i === index ? { ...e, patchResolved: true } : e)),
      )
    }
  }

  const enabled = availability.data?.enabled ?? false

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-paper lg:inset-auto lg:top-24 lg:right-6 lg:bottom-6 lg:w-[400px] lg:rounded-lg lg:bg-surface lg:shadow-elevated">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <SparklesIcon aria-hidden="true" className="size-4 text-mata" />
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="text-title font-semibold text-ink">
            {m.assistant_title()}
          </h2>
          {availability.data ? (
            <p className="text-caption text-ink-soft tabular-nums">
              {m.assistant_remaining({
                count: availability.data.remainingToday,
              })}
            </p>
          ) : null}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label={m.assistant_close()}
        >
          <XIcon aria-hidden="true" className="size-5" />
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-3">
          {availability.data && !enabled ? (
            <p className="rounded-md bg-surface-sunken p-3 text-body text-ink-soft">
              {m.assistant_unavailable()}
            </p>
          ) : (
            <p className="text-caption text-ink-soft">{m.assistant_intro()}</p>
          )}

          {entries.map((entry, index) => (
            <div key={index} className="flex flex-col gap-2">
              <div
                className={cn(
                  'max-w-[85%] rounded-lg px-3 py-2 text-body whitespace-pre-wrap',
                  entry.role === 'user'
                    ? 'self-end bg-mata text-primary-foreground'
                    : 'self-start bg-surface-sunken text-ink',
                )}
              >
                {entry.content}
              </div>

              {entry.patch ? (
                <div
                  className={cn(
                    'flex flex-col gap-2 self-start rounded-lg border border-line bg-paper p-3 lg:bg-surface',
                    entry.patchResolved && 'opacity-60',
                  )}
                >
                  <p className="text-label font-semibold text-ink">
                    {m.assistant_patch_title()}
                  </p>
                  <p className="text-caption text-ink-soft">
                    {entry.patch.summary}
                  </p>
                  <ul className="flex flex-col gap-1">
                    {entry.patch.ops.map((op, opIndex) => (
                      <li
                        key={opIndex}
                        className="flex items-center gap-2 text-caption text-ink"
                      >
                        <span
                          aria-hidden="true"
                          className="size-1.5 shrink-0 rounded-full bg-amber"
                        />
                        {opLabel(op)}
                      </li>
                    ))}
                  </ul>
                  {!entry.patchResolved ? (
                    <div className="mt-1 flex items-center gap-2">
                      <Button
                        size="sm"
                        disabled={apply.isPending}
                        onClick={() => resolvePatch(index, true)}
                      >
                        {apply.isPending ? (
                          <Loader2Icon className="size-3.5 animate-spin" />
                        ) : null}
                        {m.assistant_apply()}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={apply.isPending}
                        onClick={() => resolvePatch(index, false)}
                      >
                        {m.assistant_dismiss()}
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}

          {advise.isPending ? (
            <div className="flex items-center gap-2 self-start rounded-lg bg-surface-sunken px-3 py-2 text-body text-ink-soft">
              <Loader2Icon aria-hidden="true" className="size-4 animate-spin" />
              …
            </div>
          ) : null}
        </div>
      </div>

      <form
        className="flex items-center gap-2 border-t border-line p-3"
        onSubmit={(event) => {
          event.preventDefault()
          send()
        }}
      >
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={m.assistant_input_placeholder()}
          aria-label={m.assistant_input_placeholder()}
          disabled={!enabled || advise.isPending}
          className="flex-1"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!enabled || advise.isPending || !draft.trim()}
          aria-label={m.assistant_send()}
        >
          <SendIcon aria-hidden="true" className="size-4" />
        </Button>
      </form>
    </div>
  )
}
