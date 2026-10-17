'use client'

import { Plus } from 'lucide-react'
import { useState } from 'react'
import type { PickerRecipe } from '@/components/recipe-picker'
import { Button } from '@/components/ui/button'
import type { PlanEntry } from '@/lib/meal-plan'
import { SLOTS, type Slot } from '@/lib/validation/meal-plan'
import { AddEntryDialog } from './add-entry-dialog'
import { EntryChip } from './entry-chip'
import { SLOT_LABELS } from './slots'

export type PlanDay = {
  date: string
  label: string
  shortLabel: string
  today: boolean
  slots: { slot: Slot; entries: PlanEntry[] }[]
}

function TodayDot() {
  return (
    <>
      <span aria-hidden className="size-2 shrink-0 rounded-full bg-primary" />
      <span className="sr-only">(today)</span>
    </>
  )
}

function AddButton({
  day,
  slot,
  onAddAction,
}: {
  day: PlanDay
  slot: Slot
  onAddAction: () => void
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="shrink-0 text-muted-foreground"
      aria-label={`Add to ${day.label}, ${SLOT_LABELS[slot].toLowerCase()}`}
      onClick={onAddAction}
    >
      <Plus />
    </Button>
  )
}

export function WeekPlan({ days, recipes }: { days: PlanDay[]; recipes: PickerRecipe[] }) {
  const [adding, setAdding] = useState<{ date: string; slot: Slot } | null>(null)
  const empty = days.every((d) => d.slots.every((s) => s.entries.length === 0))

  return (
    <>
      {empty && (
        <p className="text-muted-foreground">
          Nothing planned this week. Add a recipe to a day to get started.
        </p>
      )}

      <div className="space-y-8 lg:hidden">
        {days.map((day) => (
          <section key={day.date}>
            <h2 className="flex items-center gap-2 text-xl">
              {day.label}
              {day.today && <TodayDot />}
            </h2>
            <ul className="mt-2 divide-y border-y">
              {day.slots.map(({ slot, entries }) => (
                <li key={slot} className="flex items-start gap-2 py-1">
                  <span className="w-20 shrink-0 pt-2.5 text-sm text-muted-foreground">
                    {SLOT_LABELS[slot]}
                  </span>
                  <div className="min-w-0 flex-1">
                    {entries.map((entry) => (
                      <EntryChip key={entry.id} entry={entry} />
                    ))}
                  </div>
                  <AddButton
                    day={day}
                    slot={slot}
                    onAddAction={() => setAdding({ date: day.date, slot })}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="hidden lg:block">
        <div className="grid grid-cols-7 gap-x-4 border-b pb-2">
          {days.map((day) => (
            <h2 key={day.date} className="flex items-center gap-1.5 text-lg">
              <span aria-hidden>{day.shortLabel}</span>
              <span className="sr-only">{day.label}</span>
              {day.today && <TodayDot />}
            </h2>
          ))}
        </div>
        {SLOTS.map((slot, i) => (
          <section key={slot} className="border-b py-3">
            <h3 className="text-[15px] text-muted-foreground italic">{SLOT_LABELS[slot]}</h3>
            <div className="mt-2 grid grid-cols-7 gap-x-4">
              {days.map((day) => (
                <div key={day.date} className="min-w-0 space-y-3">
                  {day.slots[i].entries.map((entry) => (
                    <EntryChip key={entry.id} entry={entry} stacked />
                  ))}
                  <AddButton
                    day={day}
                    slot={slot}
                    onAddAction={() => setAdding({ date: day.date, slot })}
                  />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {adding && (
        <AddEntryDialog
          days={days}
          recipes={recipes}
          date={adding.date}
          slot={adding.slot}
          onCloseAction={() => setAdding(null)}
        />
      )}
    </>
  )
}
