'use client'

import { Ellipsis } from 'lucide-react'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { movePlanEntry, removePlanEntry, updatePlanEntry } from '@/actions/meal-plan'
import { RecipeThumb } from '@/components/recipe-picker'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useT, useTError } from '@/i18n/client'
import type { PlanEntry } from '@/lib/meal-plan'
import { formatQuantity } from '@/lib/units'
import { cn } from '@/lib/utils'
import { SLOTS, type Slot } from '@/lib/validation/meal-plan'

type Mode = 'servings' | 'move' | 'note'

function entryName(entry: PlanEntry, hidden: string) {
  if (entry.kind === 'recipe') return entry.recipe.title
  if (entry.kind === 'note') return entry.note
  return hidden
}

export function EntryChip({ entry, stacked = false }: { entry: PlanEntry; stacked?: boolean }) {
  const [mode, setMode] = useState<Mode | null>(null)
  const [pending, startTransition] = useTransition()
  const t = useT()
  const tError = useTError()
  const name = entryName(entry, t.plan.noLongerShared)

  function remove() {
    startTransition(async () => {
      const result = await removePlanEntry(entry.id)
      if (result.error !== undefined) toast.error(tError(result.error))
      else toast.success(t.plan.removed)
    })
  }

  return (
    <div className={cn('relative flex gap-2', stacked ? 'flex-col' : 'min-h-11 items-center')}>
      <ChipBody entry={entry} stacked={stacked} />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={pending}
              aria-label={t.plan.options(name)}
              className={cn('text-muted-foreground', stacked && 'absolute top-0 right-0 size-8')}
            />
          }
        >
          <Ellipsis />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {entry.kind === 'recipe' && (
            <>
              <DropdownMenuItem onClick={() => setMode('servings')}>
                {t.plan.changeServings}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setMode('move')}>{t.plan.moveTo}</DropdownMenuItem>
            </>
          )}
          {entry.kind === 'note' && (
            <DropdownMenuItem onClick={() => setMode('note')}>{t.plan.editNote}</DropdownMenuItem>
          )}
          <DropdownMenuItem variant="destructive" onClick={remove}>
            {t.plan.remove}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={mode !== null} onOpenChange={(open) => !open && setMode(null)}>
        <DialogContent>
          {mode && (
            <EditForm key={mode} mode={mode} entry={entry} onDoneAction={() => setMode(null)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ChipBody({ entry, stacked }: { entry: PlanEntry; stacked: boolean }) {
  const t = useT()
  if (entry.kind === 'note') {
    return (
      <p className={cn('min-w-0 flex-1 text-[15px] italic', stacked && 'pr-8')}>{entry.note}</p>
    )
  }
  if (entry.kind === 'hidden') {
    return (
      <p className={cn('min-w-0 flex-1 text-sm text-muted-foreground italic', stacked && 'pr-8')}>
        {t.plan.noLongerShared}
      </p>
    )
  }
  const servings = entry.servings ?? entry.recipe.servings
  return (
    <Link
      href={`/recipes/${entry.recipe.id}`}
      className={cn(
        'group flex min-w-0 flex-1 gap-x-3 gap-y-1.5 rounded-lg',
        stacked ? 'flex-col' : 'items-center'
      )}
    >
      <RecipeThumb
        title={entry.recipe.title}
        coverImageId={entry.recipe.coverImageId}
        coverFocusX={entry.recipe.coverFocusX}
        coverFocusY={entry.recipe.coverFocusY}
      />
      <span className={cn('min-w-0 flex-1', !stacked && 'flex items-baseline gap-2')}>
        <span
          className={cn(
            'leading-snug decoration-1 underline-offset-4 group-hover:underline',
            stacked ? 'line-clamp-2 text-sm' : 'min-w-0 truncate text-[15px]'
          )}
        >
          {entry.recipe.title}
        </span>
        <span className="block shrink-0 text-[13px] text-muted-foreground tabular-nums">
          × {formatQuantity(servings)}
          <span className="sr-only"> {t.plan.servings.toLowerCase()}</span>
        </span>
      </span>
    </Link>
  )
}

function EditForm({
  mode,
  entry,
  onDoneAction,
}: {
  mode: Mode
  entry: PlanEntry
  onDoneAction: () => void
}) {
  const [servings, setServings] = useState(
    String(entry.servings ?? (entry.kind === 'recipe' ? entry.recipe.servings : 1))
  )
  const [date, setDate] = useState(entry.date)
  const [slot, setSlot] = useState<Slot>(entry.slot)
  const [note, setNote] = useState(entry.kind === 'note' ? entry.note : '')
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  const t = useT()
  const tError = useTError()
  const titles = {
    servings: t.plan.changeServings,
    move: t.plan.moveTitle,
    note: t.plan.editNote,
  }

  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const result =
        mode === 'move'
          ? await movePlanEntry(entry.id, { date, slot })
          : await updatePlanEntry(
              entry.id,
              mode === 'servings' ? { servings: Number(servings) } : { note }
            )
      if (result.error !== undefined) return setError(tError(result.error))
      onDoneAction()
    })
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle className="text-xl">{titles[mode]}</DialogTitle>
      </DialogHeader>
      {mode === 'servings' && (
        <Field>
          <FieldLabel htmlFor="entry-servings">{t.plan.servings}</FieldLabel>
          <Input
            id="entry-servings"
            type="number"
            inputMode="decimal"
            min={0.25}
            step="any"
            value={servings}
            onChange={(e) => setServings(e.target.value)}
            required
          />
        </Field>
      )}
      {mode === 'move' && (
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="entry-date">{t.plan.day}</FieldLabel>
            <Input
              id="entry-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="entry-slot">{t.plan.meal}</FieldLabel>
            <SlotSelect id="entry-slot" value={slot} onChangeAction={setSlot} />
          </Field>
        </div>
      )}
      {mode === 'note' && (
        <Field>
          <FieldLabel htmlFor="entry-note">{t.plan.note}</FieldLabel>
          <Input
            id="entry-note"
            value={note}
            maxLength={200}
            onChange={(e) => setNote(e.target.value)}
            required
          />
        </Field>
      )}
      <FieldError>{error}</FieldError>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>
          {t.common.cancel}
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? t.plan.saving : t.common.save}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function SlotSelect({
  id,
  value,
  onChangeAction,
}: {
  id: string
  value: Slot
  onChangeAction: (slot: Slot) => void
}) {
  const t = useT()
  return (
    <Select items={t.plan.slots} value={value} onValueChange={(v) => v && onChangeAction(v)}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SLOTS.map((s) => (
          <SelectItem key={s} value={s}>
            {t.plan.slots[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
