'use client'

import { ChevronsUpDown, Plus, X } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { removePantryItem, setPantryItem } from '@/actions/shopping'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { IngredientWithUnits } from '@/lib/ingredients'
import { IngredientPicker } from './ingredient-picker'

type PantryEntry = {
  ingredientId: string
  name: string
  brand: string | null
  grams: number | null
}

function parseGrams(value: string) {
  return value.trim() === '' ? null : Number(value)
}

export function PantryList({
  items,
  library,
}: {
  items: PantryEntry[]
  library: IngredientWithUnits[]
}) {
  const stocked = new Set(items.map((i) => i.ingredientId))

  return (
    <div className="space-y-6">
      <AddPantryItem library={library.filter((i) => !stocked.has(i.id))} />
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          Your pantry is empty. Items you mark as bought can be moved here.
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {items.map((item) => (
            <PantryRow key={`${item.ingredientId}-${item.grams}`} item={item} />
          ))}
        </ul>
      )}
    </div>
  )
}

function PantryRow({ item }: { item: PantryEntry }) {
  const [pending, startTransition] = useTransition()

  function save(value: string) {
    const grams = parseGrams(value)
    if (grams === item.grams) return
    startTransition(async () => {
      const result = await setPantryItem({ ingredientId: item.ingredientId, grams })
      if (result.error !== undefined) toast.error(result.error)
    })
  }

  return (
    <li className="flex items-center gap-2 py-1 pr-1 pl-3">
      <div className="min-w-0 flex-1 truncate">
        {item.name}
        {item.brand && <span className="text-muted-foreground"> · {item.brand}</span>}
      </div>
      <div className="flex items-center gap-1.5">
        <Input
          aria-label={`Amount of ${item.name} in grams`}
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          placeholder="some"
          defaultValue={item.grams ?? ''}
          disabled={pending}
          onBlur={(e) => save(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className="w-24 text-right tabular-nums"
        />
        <span className="text-sm text-muted-foreground">g</span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Remove ${item.name}`}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await removePantryItem(item.ingredientId)
          })
        }
      >
        <X />
      </Button>
    </li>
  )
}

function AddPantryItem({ library }: { library: IngredientWithUnits[] }) {
  const [picked, setPicked] = useState<IngredientWithUnits | null>(null)
  const [grams, setGrams] = useState('')
  const [pending, startTransition] = useTransition()

  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!picked) return void toast.error('Pick an ingredient')
    startTransition(async () => {
      const result = await setPantryItem({ ingredientId: picked.id, grams: parseGrams(grams) })
      if (result.error !== undefined) return void toast.error(result.error)
      setPicked(null)
      setGrams('')
    })
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-[1fr_6rem_auto] gap-2">
      <IngredientPicker
        library={library}
        value={picked?.id ?? null}
        onSelectAction={setPicked}
        className="min-w-0 justify-between font-normal"
      >
        <span className={picked ? 'truncate' : 'truncate text-muted-foreground'}>
          {picked?.name ?? 'Pick ingredient'}
        </span>
        <ChevronsUpDown className="text-muted-foreground" />
      </IngredientPicker>
      <Input
        aria-label="Grams"
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        placeholder="g (some)"
        value={grams}
        onChange={(e) => setGrams(e.target.value)}
      />
      <Button type="submit" disabled={pending}>
        <Plus />
        Add
      </Button>
    </form>
  )
}
