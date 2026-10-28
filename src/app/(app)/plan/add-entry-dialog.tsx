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
import { useT, useTError } from '@/i18n/client'
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
  const t = useT()
  const tError = useTError()
  const dayLabels = Object.fromEntries(days.map((d) => [d.date, d.label]))

  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (kind === 'recipe' && !recipe) return setError(t.plan.pickRecipe)
    startTransition(async () => {
      const result = await addPlanEntry(
        kind === 'recipe'
          ? { date: day, slot: meal, recipeId: recipe?.id, servings: Number(servings) }
          : { date: day, slot: meal, note }
      )
      if ('error' in result) return setError(tError(result.error))
      onCloseAction()
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onCloseAction()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle className="text-xl">{t.plan.addTitle}</DialogTitle>
          </DialogHeader>
          <Tabs
            value={kind}
            onValueChange={(value: Kind) => {
              setKind(value)
              setError(undefined)
            }}
          >
            <TabsList className="w-full">
              <TabsTrigger value="recipe">{t.plan.recipe}</TabsTrigger>
              <TabsTrigger value="note">{t.plan.note}</TabsTrigger>
            </TabsList>
          </Tabs>

          {kind === 'recipe' ? (
            <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
              <Field>
                <FieldLabel>{t.plan.recipe}</FieldLabel>
                <RecipePicker
                  recipes={recipes}
                  value={recipe?.id ?? null}
                  label={t.plan.recipe}
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
                        coverFocusX={recipe.coverFocusX}
                        coverFocusY={recipe.coverFocusY}
                        className="size-8 text-base"
                      />
                      <span className="truncate">{recipe.title}</span>
                    </>
                  ) : (
                    <span className="pl-2 text-muted-foreground">{t.plan.chooseRecipe}</span>
                  )}
                </RecipePicker>
              </Field>
              <Field>
                <FieldLabel htmlFor="add-servings">{t.plan.servings}</FieldLabel>
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
              <FieldLabel htmlFor="add-note">{t.plan.note}</FieldLabel>
              <Input
                id="add-note"
                value={note}
                maxLength={200}
                placeholder={t.plan.notePlaceholder}
                onChange={(e) => setNote(e.target.value)}
                required
              />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="add-day">{t.plan.day}</FieldLabel>
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
              <FieldLabel htmlFor="add-slot">{t.plan.meal}</FieldLabel>
              <SlotSelect id="add-slot" value={meal} onChangeAction={setMeal} />
            </Field>
          </div>

          <FieldError>{error}</FieldError>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t.common.cancel}
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? t.plan.adding : t.plan.addToPlan}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
