'use client'

import { Carrot } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { addShoppingItem } from '@/actions/shopping'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { IngredientWithUnits } from '@/lib/ingredients'
import { builtInUnitsFor } from '@/lib/units'
import { IngredientPicker } from './ingredient-picker'

export function AddItemForm({ library }: { library: IngredientWithUnits[] }) {
  const [name, setName] = useState('')
  const [linked, setLinked] = useState<IngredientWithUnits | null>(null)
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('')
  const [pending, startTransition] = useTransition()

  const custom = linked?.units ?? []
  const units = [...builtInUnitsFor(custom), ...custom].map((u) => u.name)

  function link(ingredient: IngredientWithUnits) {
    setLinked(ingredient)
    setName(ingredient.name)
  }

  function rename(value: string) {
    setName(value)
    if (linked && value !== linked.name) setLinked(null)
  }

  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const amount = quantity.trim() === '' ? null : Number(quantity)
    startTransition(async () => {
      const result = await addShoppingItem({
        name,
        quantity: amount,
        unit: amount === null ? null : unit,
        ingredientId: linked?.id ?? null,
      })
      if (result.error !== undefined) return void toast.error(result.error)
      setName('')
      setLinked(null)
      setQuantity('')
      setUnit('')
    })
  }

  return (
    <form
      onSubmit={submit}
      className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
    >
      <Input
        aria-label="Item"
        placeholder="Add an item"
        value={name}
        onChange={(e) => rename(e.target.value)}
        required
        className="rounded-full px-4"
      />
      <IngredientPicker
        library={library}
        value={linked?.id ?? null}
        onSelectAction={link}
        label="Link to an ingredient"
        className={linked ? 'border-primary text-primary' : 'text-muted-foreground'}
      >
        <Carrot />
        <span className="sr-only sm:not-sr-only">{linked ? 'Linked' : 'Link'}</span>
      </IngredientPicker>
      {name.trim() && (
        <div className="col-span-2 grid grid-cols-[5rem_minmax(0,1fr)_auto] gap-2 sm:col-span-1 sm:grid-cols-[5rem_6rem_auto]">
          <Input
            aria-label="Quantity"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            placeholder="Qty"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <Input
            aria-label="Unit"
            placeholder="Unit"
            list="shopping-units"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          />
          <datalist id="shopping-units">
            {units.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
          <Button type="submit" disabled={pending}>
            Add
          </Button>
        </div>
      )}
    </form>
  )
}
