'use client'

import { PackageCheck, Trash2, X } from 'lucide-react'
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
      <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
        Your list is empty. Add items above or from a recipe.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={pending || !anyLinkedChecked}
          onClick={() => run(markBoughtIntoPantry, 'Moved bought items to the pantry')}
        >
          <PackageCheck />
          Move bought to pantry
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={pending || !anyChecked}
          onClick={() => run(clearCheckedItems, 'Cleared bought items')}
        >
          Clear bought
        </Button>
        <ClearAllButton />
      </div>

      {toBuy.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {toBuy.map((need) => (
            <NeedItem key={need.ingredientId} need={need} />
          ))}
        </ul>
      )}

      {freeText.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-medium">Other items</h2>
          <ul className="divide-y rounded-lg border">
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
        <section className="space-y-2">
          <h2 className="font-medium">Covered by pantry</h2>
          <ul className="divide-y rounded-lg border opacity-60">
            {covered.map((need) => (
              <NeedItem key={need.ingredientId} need={need} />
            ))}
          </ul>
        </section>
      )}
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
          <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
            {hint && <span>{hint}</span>}
            {[...recipes].map(([id, title]) => (
              <Link key={id} href={`/recipes/${id}`} className="underline-offset-2 hover:underline">
                {title}
              </Link>
            ))}
          </div>
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
    <li className="flex items-center gap-2 py-1 pr-1 pl-3">
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-2">
        <Checkbox checked={optimistic} onCheckedChange={toggle} className="size-5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className={cn('truncate', optimistic && 'text-muted-foreground line-through')}>
              {name}
            </span>
            {amount && (
              <span className="shrink-0 text-sm tabular-nums">
                {amount}
                {secondary && <span className="text-muted-foreground"> · {secondary}</span>}
              </span>
            )}
          </div>
          {details}
        </div>
      </label>
      <Button
        variant="ghost"
        size="icon"
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
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Trash2 />
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
