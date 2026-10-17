'use client'

import { useState, useTransition } from 'react'
import { addPlanEntry } from '@/actions/meal-plan'
import { type PickerRecipe, RecipePicker, RecipeThumb } from '@/components/recipe-picker'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Slot } from '@/lib/validation/meal-plan'
import { SlotSelect } from './entry-chip'

type Kind = 'recipe' | 'note'

export function AddEntryDialog({
  days,
  recipes,
  date,
  slot,
  onCloseAction,
}: {
  days: { date: string; label: string }[]
  recipes: PickerRecipe[]
  date: string
  slot: Slot
  onCloseAction: () => void
}) {
  const [kind, setKind] = useState<Kind>('recipe')
  const [day, setDay] = useState(date)
  const [meal, setMeal] = useState(slot)
  const [recipe, setRecipe] = useState<PickerRecipe | null>(null)
  const [servings, setServings] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  const dayLabels = Object.fromEntries(days.map((d) => [d.date, d.label]))

  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (kind === 'recipe' && !recipe) return setError('Pick a recipe')
    startTransition(async () => {
      const result = await addPlanEntry(
        kind === 'recipe'
          ? { date: day, slot: meal, recipeId: recipe?.id, servings: Number(servings) }
          : { date: day, slot: meal, note }
      )
      if ('error' in result) return setError(result.error)
      onCloseAction()
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onCloseAction()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle className="text-xl">Add to the plan</DialogTitle>
          </DialogHeader>
          <Tabs
            value={kind}
            onValueChange={(value: Kind) => {
              setKind(value)
              setError(undefined)
            }}
          >
            <TabsList className="w-full">
              <TabsTrigger value="recipe">Recipe</TabsTrigger>
              <TabsTrigger value="note">Note</TabsTrigger>
            </TabsList>
          </Tabs>

          {kind === 'recipe' ? (
            <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
              <Field>
                <FieldLabel>Recipe</FieldLabel>
                <RecipePicker
                  recipes={recipes}
                  value={recipe?.id ?? null}
                  label="Recipe"
                  className="h-auto min-h-11 w-full justify-start gap-2 py-1 pl-1 font-normal sm:min-h-10"
                  onSelectAction={(picked) => {
                    setRecipe(picked)
                    setServings(String(picked.servings))
                    setError(undefined)
                  }}
                >
                  {recipe ? (
                    <>
                      <RecipeThumb
                        title={recipe.title}
                        coverImageId={recipe.coverImageId}
                        className="size-8 text-base"
                      />
                      <span className="truncate">{recipe.title}</span>
                    </>
                  ) : (
                    <span className="pl-2 text-muted-foreground">Choose a recipe</span>
                  )}
                </RecipePicker>
              </Field>
              <Field>
                <FieldLabel htmlFor="add-servings">Servings</FieldLabel>
                <Input
                  id="add-servings"
                  type="number"
                  inputMode="decimal"
                  min={0.25}
                  step="any"
                  value={servings}
                  onChange={(e) => setServings(e.target.value)}
                  required
                />
              </Field>
            </div>
          ) : (
            <Field>
              <FieldLabel htmlFor="add-note">Note</FieldLabel>
              <Input
                id="add-note"
                value={note}
                maxLength={200}
                placeholder="Leftovers, eating out…"
                onChange={(e) => setNote(e.target.value)}
                required
              />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="add-day">Day</FieldLabel>
              <Select items={dayLabels} value={day} onValueChange={(v) => v && setDay(v)}>
                <SelectTrigger id="add-day" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {days.map((d) => (
                    <SelectItem key={d.date} value={d.date}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="add-slot">Meal</FieldLabel>
              <SlotSelect id="add-slot" value={meal} onChangeAction={setMeal} />
            </Field>
          </div>

          <FieldError>{error}</FieldError>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? 'Adding…' : 'Add to plan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
