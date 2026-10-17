'use client'

import { X } from 'lucide-react'
import Link from 'next/link'
import { useOptimistic, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  clearCheckedItems,
  clearShoppingList,
  markBoughtIntoPantry,
  removeShoppingItems,
  toggleShoppingItems,
} from '@/actions/shopping'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { formatGrams } from '@/lib/nutrition'
import type { applyPantry, ShoppingLine } from '@/lib/shopping'
import { formatQuantity } from '@/lib/units'
import { cn } from '@/lib/utils'

export type ListItem = ShoppingLine & {
  id: string
  checked: boolean
  recipe: { id: string; title: string } | null
}

type NeedRow = ReturnType<typeof applyPantry<ListItem>>[number]

function amount(quantity: number | null, unit: string | null, grams: number | null) {
  const display = quantity !== null && unit !== null ? `${formatQuantity(quantity)} ${unit}` : null
  const weight = grams !== null && unit !== 'g' ? `${formatGrams(grams)} g` : null
  return { display, weight }
}

function haveLabel(grams: number | null) {
  return grams === null ? 'some' : `${formatGrams(grams)} g`
}

export function ShoppingList({ needs, freeText }: { needs: NeedRow[]; freeText: ListItem[] }) {
  const [pending, startTransition] = useTransition()
  const toBuy = needs.filter((n) => !n.covered)
  const covered = needs.filter((n) => n.covered)
  const all = [...needs.flatMap((n) => n.lines), ...freeText]
  const anyChecked = all.some((i) => i.checked)
  const anyLinkedChecked = needs.some((n) => n.lines.some((l) => l.checked))

  function run(action: () => Promise<object>, message: string) {
    startTransition(async () => {
      await action()
      toast.success(message)
    })
  }

  if (all.length === 0) {
    return (
      <div className="space-y-2 py-6">
        <p className="font-heading text-2xl font-medium">Nothing to buy.</p>
        <p className="text-muted-foreground">
          Add an item above, or add the ingredients of a{' '}
          <Link href="/" className="text-primary underline underline-offset-4">
            recipe
          </Link>
          .
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      {toBuy.length > 0 && (
        <ul className="divide-y">
          {toBuy.map((need) => (
            <NeedItem key={need.ingredientId} need={need} />
          ))}
        </ul>
      )}

      {freeText.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xl">Other items</h2>
          <ul className="divide-y">
            {freeText.map((item) => (
              <Row
                key={item.id}
                ids={[item.id]}
                checked={item.checked}
                name={item.name}
                amount={
                  item.quantity === null
                    ? null
                    : `${formatQuantity(item.quantity)} ${item.unit ?? ''}`.trim()
                }
              />
            ))}
          </ul>
        </section>
      )}

      {covered.length > 0 && (
        <section className="space-y-1 rounded-lg bg-secondary px-4 pt-4 pb-1">
          <h2 className="text-xl">Covered by pantry</h2>
          <ul className="divide-y divide-foreground/10 opacity-70">
            {covered.map((need) => (
              <NeedItem key={need.ingredientId} need={need} />
            ))}
          </ul>
        </section>
      )}

      <div className="-mt-4 -ml-3.5 flex flex-wrap gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="text-primary hover:text-primary"
          disabled={pending || !anyLinkedChecked}
          onClick={() => run(markBoughtIntoPantry, 'Moved bought items to the pantry')}
        >
          Move bought to pantry
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending || !anyChecked}
          onClick={() => run(clearCheckedItems, 'Cleared bought items')}
        >
          Clear bought
        </Button>
        <ClearAllButton />
      </div>
    </div>
  )
}

function NeedItem({ need }: { need: NeedRow }) {
  const recipes = new Map<string, string>()
  for (const line of need.lines) if (line.recipe) recipes.set(line.recipe.id, line.recipe.title)
  const { display, weight } = need.covered
    ? amount(need.quantity, need.unit, need.neededGrams)
    : amount(need.toBuyQuantity, need.unit, need.toBuyGrams)
  const hint = need.haveGrams === 0 ? null : `have ${haveLabel(need.haveGrams)} in pantry`

  return (
    <Row
      ids={need.lines.map((l) => l.id)}
      checked={need.lines.every((l) => l.checked)}
      name={need.name}
      amount={display ?? weight}
      secondary={display ? weight : null}
      details={
        (hint || recipes.size > 0) && (
          <p className="mt-0.5 flex flex-wrap gap-x-3 text-[13px] text-muted-foreground">
            {recipes.size > 0 && (
              <span>
                for{' '}
                {[...recipes].map(([id, title], index) => (
                  <span key={id}>
                    {index > 0 && ', '}
                    <Link href={`/recipes/${id}`} className="underline underline-offset-2">
                      {title}
                    </Link>
                  </span>
                ))}
              </span>
            )}
            {hint && <span>{hint}</span>}
          </p>
        )
      }
    />
  )
}

function Row({
  ids,
  checked,
  name,
  amount,
  secondary,
  details,
}: {
  ids: string[]
  checked: boolean
  name: string
  amount: string | null
  secondary?: string | null
  details?: React.ReactNode
}) {
  const [optimistic, setOptimistic] = useOptimistic(checked)
  const [pending, startTransition] = useTransition()

  function toggle(next: boolean) {
    startTransition(async () => {
      setOptimistic(next)
      await toggleShoppingItems(ids, next)
    })
  }

  return (
    <li className="flex min-h-12 items-center gap-1">
      <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 py-3">
        <Checkbox checked={optimistic} onCheckedChange={toggle} className="mt-px size-6" />
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              'flex items-baseline justify-between gap-3 transition-colors duration-150',
              optimistic && 'text-muted-foreground'
            )}
          >
            <span
              className={cn(
                'min-w-0 text-[17px] leading-snug line-through decoration-1 transition-colors duration-150',
                optimistic ? 'decoration-current' : 'decoration-transparent'
              )}
            >
              {name}
            </span>
            {amount && (
              <span className="shrink-0 text-right text-[15px] tabular-nums">
                {amount}
                {secondary && <span className="ml-1.5 text-muted-foreground">({secondary})</span>}
              </span>
            )}
          </div>
          {details}
        </div>
      </label>
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground"
        aria-label={`Remove ${name}`}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await removeShoppingItems(ids)
          })
        }
      >
        <X />
      </Button>
    </li>
  )
}

function ClearAllButton() {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function confirm() {
    startTransition(async () => {
      await clearShoppingList()
      setOpen(false)
      toast.success('Shopping list cleared')
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          />
        }
      >
        Clear all
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clear the shopping list?</DialogTitle>
          <DialogDescription>
            This removes every item. The pantry is not affected.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button variant="destructive" onClick={confirm} disabled={pending}>
            {pending ? 'Clearing…' : 'Clear all'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
