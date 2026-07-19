import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BedDoubleIcon,
  BusIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CircleDotIcon,
  LandmarkIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  UtensilsIcon,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { toast } from 'sonner'

import { ConfirmDialog } from '#/components/editor/ConfirmDialog'
import { StopForm } from '#/components/editor/StopForm'
import type { StopFormValues } from '#/components/editor/StopForm'
import { ResponsiveSheet } from '#/components/ResponsiveSheet'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Field, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { Textarea } from '#/components/ui/textarea'
import { cn } from '#/lib/utils'
import { formatCentsToCostInput } from '#/lib/cost'
import { formatCost } from '#/lib/currency'
import { m } from '#/paraglide/messages'
import {
  addDay,
  addStop,
  removeDay,
  removeStop,
  reorderStops,
  updateDay,
  updateStop,
} from '#/server/days-stops'
import type { DayView, StopView } from '#/server/itineraries'

const CATEGORY_ICON: Record<StopView['category'], LucideIcon> = {
  attraction: LandmarkIcon,
  food: UtensilsIcon,
  lodging: BedDoubleIcon,
  transport: BusIcon,
  other: CircleDotIcon,
}

const CATEGORY_LABEL: Record<StopView['category'], () => string> = {
  attraction: m.stop_category_attraction,
  food: m.stop_category_food,
  lodging: m.stop_category_lodging,
  transport: m.stop_category_transport,
  other: m.stop_category_other,
}

function stopFormValuesFrom(stop: StopView): StopFormValues {
  return {
    name: stop.name,
    category: stop.category,
    description: stop.description ?? '',
    startTime: stop.startTime ? stop.startTime.slice(0, 5) : '',
    cost: formatCentsToCostInput(stop.costCents),
    placeLabel: stop.placeLabel ?? '',
    lat: stop.lat,
    lng: stop.lng,
  }
}

/**
 * Days + stops editor: add/remove days (with confirm), inline day
 * title/note editing, per-stop add/edit via `StopForm` in a dialog, and
 * up/down reordering (no drag-and-drop in the MVP — see the design doc's
 * Out of scope section). Every mutation invalidates broadly (see
 * `invalidate` below) so the day/stop list — and anywhere else `dayCount`
 * surfaces — reflects the latest server state after a round trip.
 */
export function DayEditor({
  itineraryId,
  days,
  currency,
}: {
  itineraryId: string
  days: DayView[]
  /** ISO 4217 code all stop costs are in (itinerary-level selector). */
  currency: string
}) {
  const queryClient = useQueryClient()

  // Broad invalidation (any cached query keyed under `'itineraries'`), not
  // just this itinerary's editor entry — adding/removing a day changes
  // `dayCount`, which the `/my` lists and (once published) discovery search
  // cards also display. See `PublishCard`'s doc comment for the same
  // reasoning.
  function invalidate() {
    return queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[0] === 'itineraries',
    })
  }

  const addDayMutation = useMutation({
    mutationFn: () => addDay({ data: { itineraryId } }),
    onSuccess: () => void invalidate(),
    onError: () => toast.error(m.editor_day_add_error()),
  })

  const removeDayMutation = useMutation({
    mutationFn: (dayId: string) => removeDay({ data: { id: dayId } }),
    onSuccess: () => void invalidate(),
    onError: () => toast.error(m.editor_day_remove_error()),
  })

  const updateDayMutation = useMutation({
    mutationFn: (input: Parameters<typeof updateDay>[0]['data']) =>
      updateDay({ data: input }),
    onSuccess: () => void invalidate(),
    onError: () => toast.error(m.editor_day_update_error()),
  })

  const addStopMutation = useMutation({
    mutationFn: (input: Parameters<typeof addStop>[0]['data']) =>
      addStop({ data: input }),
    onSuccess: () => void invalidate(),
    onError: () => toast.error(m.editor_stop_add_error()),
  })

  const updateStopMutation = useMutation({
    mutationFn: (input: Parameters<typeof updateStop>[0]['data']) =>
      updateStop({ data: input }),
    onSuccess: () => void invalidate(),
    onError: () => toast.error(m.editor_stop_update_error()),
  })

  const removeStopMutation = useMutation({
    mutationFn: (stopId: string) => removeStop({ data: { id: stopId } }),
    onSuccess: () => void invalidate(),
    onError: () => toast.error(m.editor_stop_remove_error()),
  })

  const reorderStopsMutation = useMutation({
    mutationFn: (input: { dayId: string; stopIds: string[] }) =>
      reorderStops({ data: input }),
    onSuccess: () => void invalidate(),
    onError: () => toast.error(m.editor_stop_reorder_error()),
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-headline font-semibold text-ink">
          {m.editor_days_title()}
        </h2>
        <Button
          size="sm"
          variant="outline"
          disabled={addDayMutation.isPending}
          onClick={() => addDayMutation.mutate()}
        >
          <PlusIcon data-icon="inline-start" />
          {m.editor_day_add()}
        </Button>
      </div>

      {days.map((day) => (
        <DayCard
          key={day.id}
          day={day}
          currency={currency}
          canRemove={days.length > 1}
          onUpdateDay={(values) =>
            updateDayMutation.mutate({ id: day.id, ...values })
          }
          onRemoveDay={() => removeDayMutation.mutateAsync(day.id)}
          onAddStop={(values) =>
            addStopMutation.mutateAsync({ dayId: day.id, ...values })
          }
          onUpdateStop={(stopId, values) =>
            updateStopMutation.mutateAsync({ id: stopId, ...values })
          }
          onRemoveStop={(stopId) => removeStopMutation.mutateAsync(stopId)}
          onReorderStop={(stopIds) =>
            reorderStopsMutation.mutateAsync({ dayId: day.id, stopIds })
          }
        />
      ))}
    </div>
  )
}

interface StopMutationValues {
  name: string
  category: StopView['category']
  description: string | null
  startTime: string | null
  costCents: number | null
  placeLabel: string | null
  lat: number | null
  lng: number | null
}

function DayCard({
  day,
  currency,
  canRemove,
  onUpdateDay,
  onRemoveDay,
  onAddStop,
  onUpdateStop,
  onRemoveStop,
  onReorderStop,
}: {
  day: DayView
  currency: string
  canRemove: boolean
  onUpdateDay: (values: { title?: string | null; note?: string | null }) => void
  onRemoveDay: () => Promise<void>
  onAddStop: (values: StopMutationValues) => Promise<unknown>
  onUpdateStop: (stopId: string, values: StopMutationValues) => Promise<unknown>
  onRemoveStop: (stopId: string) => Promise<unknown>
  onReorderStop: (stopIds: string[]) => Promise<unknown>
}) {
  const [addOpen, setAddOpen] = useState(false)
  const [editingStopId, setEditingStopId] = useState<string | null>(null)
  // Days start expanded — an itinerary being actively edited usually has
  // only a handful, and collapsing everything by default would hide the
  // "add stop" affordance the author most likely wants right away. Once a
  // day's stops are filled in, collapsing it back down is what keeps a
  // multi-day itinerary scannable on a phone (DESIGN.md's mobile app-shell
  // density note) instead of one long scroll of every day's full form.
  const [collapsed, setCollapsed] = useState(false)

  const editingStop = day.stops.find((s) => s.id === editingStopId) ?? null

  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= day.stops.length) return
    const next = [...day.stops.map((s) => s.id)]
    ;[next[index], next[target]] = [next[target], next[index]]
    void onReorderStop(next)
  }

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="px-0">
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-expanded={!collapsed}
          className="flex w-full items-center gap-3 px-5 py-4 text-left sm:px-6"
        >
          {/*
            Day number as a designed element — a badge, not just a number
            inline in the heading text — echoing the itinerary detail
            page's logbook-spine day marker (`DayTimeline`).
          */}
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-mata-soft text-title font-semibold tabular-nums text-mata-soft-foreground"
          >
            {day.dayNumber}
          </span>
          <CardTitle className="min-w-0 flex-1 truncate font-display text-headline text-ink">
            {day.title ? (
              <>
                <span className="sr-only">
                  {m.editor_day_label({ number: day.dayNumber })}:{' '}
                </span>
                {day.title}
              </>
            ) : (
              m.editor_day_label({ number: day.dayNumber })
            )}
          </CardTitle>
          {(() => {
            const dayTotal = day.stops.reduce(
              (sum, s) => sum + (s.costCents ?? 0),
              0,
            )
            return dayTotal > 0 ? (
              <span className="shrink-0 text-caption text-ink-soft tabular-nums">
                {m.editor_day_subtotal({
                  amount: formatCost(dayTotal, currency),
                })}
              </span>
            ) : null
          })()}
          <ChevronDownIcon
            aria-hidden="true"
            className={cn(
              'size-5 shrink-0 text-ink-soft transition-transform',
              !collapsed && 'rotate-180',
            )}
          />
          <span className="sr-only">
            {collapsed ? m.editor_day_expand() : m.editor_day_collapse()}
          </span>
        </button>
      </CardHeader>

      {collapsed ? null : (
        <>
          <CardContent className="flex flex-col gap-4 pt-2 pb-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`day-title-${day.id}`}>
                  {m.editor_day_field_title()}
                </FieldLabel>
                <Input
                  id={`day-title-${day.id}`}
                  defaultValue={day.title ?? ''}
                  onBlur={(event) => {
                    const value = event.target.value
                    if (value !== (day.title ?? '')) {
                      onUpdateDay({ title: value || null })
                    }
                  }}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`day-note-${day.id}`}>
                  {m.editor_day_field_note()}
                </FieldLabel>
                <Textarea
                  id={`day-note-${day.id}`}
                  defaultValue={day.note ?? ''}
                  onBlur={(event) => {
                    const value = event.target.value
                    if (value !== (day.note ?? '')) {
                      onUpdateDay({ note: value || null })
                    }
                  }}
                />
              </Field>
            </div>

            {day.stops.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {m.editor_stop_empty()}
              </p>
            ) : (
              // Quiet divided rows, not boxed cards-within-a-card — DESIGN.md's
              // Quiet Lift Rule and "don't nest a card inside a card" rule,
              // matching the read-only `StopList`'s row treatment instead of
              // the previous `rounded-md border p-3` boxed-list pattern.
              <ol className="flex flex-col">
                {day.stops.map((stop, index) => {
                  const Icon = CATEGORY_ICON[stop.category]
                  return (
                    <li
                      key={stop.id}
                      className="flex items-start gap-3 border-b border-line py-3 first:pt-0 last:border-b-0 last:pb-0"
                    >
                      <span
                        className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-ink"
                        title={CATEGORY_LABEL[stop.category]()}
                      >
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-title font-medium text-ink">
                          {stop.name}
                        </span>
                        {stop.description ? (
                          <span className="measure-prose text-body text-ink-soft">
                            {stop.description}
                          </span>
                        ) : null}
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-caption tabular-nums text-ink-soft">
                          {stop.placeLabel ? (
                            <span>{stop.placeLabel}</span>
                          ) : null}
                          {stop.costCents !== null ? (
                            <span>
                              {formatCost(stop.costCents, currency)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={index === 0}
                          aria-label={m.editor_stop_move_up()}
                          onClick={() => move(index, -1)}
                        >
                          <ChevronUpIcon />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={index === day.stops.length - 1}
                          aria-label={m.editor_stop_move_down()}
                          onClick={() => move(index, 1)}
                        >
                          <ChevronDownIcon />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={m.editor_stop_edit()}
                          onClick={() => setEditingStopId(stop.id)}
                        >
                          <PencilIcon />
                        </Button>
                        <ConfirmDialog
                          trigger={
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={m.editor_stop_remove()}
                            >
                              <Trash2Icon />
                            </Button>
                          }
                          title={m.editor_stop_remove_confirm_title()}
                          description={m.editor_stop_remove_confirm_description()}
                          onConfirm={() => onRemoveStop(stop.id)}
                        />
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => setAddOpen(true)}
            >
              <PlusIcon data-icon="inline-start" />
              {m.editor_stop_add()}
            </Button>

            <ResponsiveSheet
              open={addOpen}
              onOpenChange={setAddOpen}
              title={m.editor_stop_add()}
            >
              <StopForm
                submitLabel={m.editor_stop_save()}
                onCancel={() => setAddOpen(false)}
                onSubmit={async (values) => {
                  await onAddStop(values)
                  setAddOpen(false)
                }}
              />
            </ResponsiveSheet>

            <ResponsiveSheet
              open={editingStop !== null}
              onOpenChange={(open) => !open && setEditingStopId(null)}
              title={m.editor_stop_edit()}
            >
              {editingStop ? (
                <StopForm
                  defaultValues={stopFormValuesFrom(editingStop)}
                  submitLabel={m.editor_stop_save()}
                  onCancel={() => setEditingStopId(null)}
                  onSubmit={async (values) => {
                    await onUpdateStop(editingStop.id, values)
                    setEditingStopId(null)
                  }}
                />
              ) : null}
            </ResponsiveSheet>
          </CardContent>

          <CardFooter className="pb-6">
            <ConfirmDialog
              trigger={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!canRemove}
                >
                  <Trash2Icon data-icon="inline-start" />
                  {m.editor_day_remove()}
                </Button>
              }
              title={m.editor_day_remove_confirm_title()}
              description={m.editor_day_remove_confirm_description()}
              onConfirm={onRemoveDay}
            />
          </CardFooter>
        </>
      )}
    </Card>
  )
}
