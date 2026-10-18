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
import type { Locale } from '@/i18n'
import { useLocale, useT } from '@/i18n/client'
import { unitLabel } from '@/i18n/format'
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

function amount(
  quantity: number | null,
  unit: string | null,
  grams: number | null,
  locale: Locale
) {
  const display =
    quantity !== null && unit !== null
      ? `${formatQuantity(quantity)} ${unitLabel(unit, locale)}`
      : null
  const weight = grams !== null && unit !== 'g' ? `${formatGrams(grams)} g` : null
  return { display, weight }
}

function haveLabel(grams: number | null) {
  return grams === null ? null : `${formatGrams(grams)} g`
}

export function ShoppingList({ needs, freeText }: { needs: NeedRow[]; freeText: ListItem[] }) {
  const t = useT()
  const locale = useLocale()
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
        <p className="font-heading text-2xl font-medium">{t.shopping.nothingToBuy}</p>
        <p className="text-muted-foreground">
          {t.shopping.emptyHintBefore}{' '}
          <Link href="/" className="text-primary underline underline-offset-4">
            {t.shopping.emptyHintLink}
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
          <h2 className="text-xl">{t.shopping.otherItems}</h2>
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
                    : `${formatQuantity(item.quantity)} ${item.unit === null ? '' : unitLabel(item.unit, locale)}`.trim()
                }
              />
            ))}
          </ul>
        </section>
      )}

      {covered.length > 0 && (
        <section className="space-y-1 rounded-lg bg-secondary px-4 pt-4 pb-1">
          <h2 className="text-xl">{t.shopping.coveredByPantry}</h2>
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
          onClick={() => run(markBoughtIntoPantry, t.shopping.movedBought)}
        >
          {t.shopping.moveBought}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending || !anyChecked}
          onClick={() => run(clearCheckedItems, t.shopping.clearedBought)}
        >
          {t.shopping.clearBought}
        </Button>
        <ClearAllButton />
      </div>
    </div>
  )
}

function NeedItem({ need }: { need: NeedRow }) {
  const t = useT()
  const locale = useLocale()
  const recipes = new Map<string, string>()
  for (const line of need.lines) if (line.recipe) recipes.set(line.recipe.id, line.recipe.title)
  const { display, weight } = need.covered
    ? amount(need.quantity, need.unit, need.neededGrams, locale)
    : amount(need.toBuyQuantity, need.unit, need.toBuyGrams, locale)
  const hint = need.haveGrams === 0 ? null : t.shopping.haveInPantry(haveLabel(need.haveGrams))

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
                {t.shopping.forRecipes}{' '}
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
  const t = useT()
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
        aria-label={t.shopping.remove(name)}
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
  const t = useT()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function confirm() {
    startTransition(async () => {
      await clearShoppingList()
      setOpen(false)
      toast.success(t.shopping.listCleared)
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
        {t.shopping.clearAll}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.shopping.clearAllTitle}</DialogTitle>
          <DialogDescription>{t.shopping.clearAllDescription}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>{t.common.cancel}</DialogClose>
          <Button variant="destructive" onClick={confirm} disabled={pending}>
            {pending ? t.shopping.clearing : t.shopping.clearAll}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
