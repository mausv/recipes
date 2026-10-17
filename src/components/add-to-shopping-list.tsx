'use client'

import { ShoppingCart } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { addRecipeToShoppingList } from '@/actions/shopping'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export function AddToShoppingListButton({
  recipeId,
  defaultServings,
}: {
  recipeId: string
  defaultServings: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [servings, setServings] = useState(String(defaultServings))
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()

  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const result = await addRecipeToShoppingList({ recipeId, servings: Number(servings) })
      if (result.error !== undefined) return setError(result.error)
      setError(undefined)
      setOpen(false)
      toast.success(`Added ${result.added} ${result.added === 1 ? 'item' : 'items'} to the list`, {
        action: { label: 'View list', onClick: () => router.push('/shopping') },
      })
    })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" />}>
        <ShoppingCart />
        Add to list
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60">
        <form onSubmit={submit} className="space-y-3">
          <Field>
            <FieldLabel htmlFor="shopping-servings">Servings</FieldLabel>
            <Input
              id="shopping-servings"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={servings}
              onChange={(e) => setServings(e.target.value)}
              required
            />
          </Field>
          <FieldError>{error}</FieldError>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? 'Adding…' : 'Add to shopping list'}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}
