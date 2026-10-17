'use client'

import { ArrowDown, ArrowUp, ChevronsUpDown, ImagePlus, Plus, X } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createRecipe, updateRecipe, uploadRecipeImage } from '@/actions/recipes'
import { MacroSummary } from '@/components/macro-summary'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { IngredientWithUnits } from '@/lib/ingredients'
import { computeRecipeBreakdown, formatGrams } from '@/lib/nutrition'
import { BASE_UNITS, toGrams } from '@/lib/units'
import { cn, move } from '@/lib/utils'
import type { RecipeInput } from '@/lib/validation/recipe'

type Line = { key: number; ingredientId: string; quantity: string; unit: string; groupName: string }
type Step = { key: number; text: string; imageId: string | null }

let nextKey = 0

function unitsFor(ingredient: IngredientWithUnits | undefined) {
  return [...BASE_UNITS, ...(ingredient?.units.map((u) => u.name) ?? [])]
}

export function RecipeForm({
  library,
  recipe,
}: {
  library: IngredientWithUnits[]
  recipe?: RecipeInput & { id: string }
}) {
  const router = useRouter()
  const byId = new Map(library.map((i) => [i.id, i]))

  const [title, setTitle] = useState(recipe?.title ?? '')
  const [description, setDescription] = useState(recipe?.description ?? '')
  const [servings, setServings] = useState(String(recipe?.servings ?? 2))
  const [cookedWeight, setCookedWeight] = useState(
    recipe?.cookedWeightGrams ? String(recipe.cookedWeightGrams) : ''
  )
  const [tags, setTags] = useState(recipe?.tags.join(', ') ?? '')
  const [coverImageId, setCoverImageId] = useState(recipe?.coverImageId ?? null)
  const [lines, setLines] = useState<Line[]>(
    () =>
      recipe?.ingredients.map((l) => ({
        key: nextKey++,
        ingredientId: l.ingredientId,
        quantity: String(l.quantity),
        unit: l.unit,
        groupName: l.groupName ?? '',
      })) ?? []
  )
  const [steps, setSteps] = useState<Step[]>(
    () => recipe?.steps.map((s) => ({ key: nextKey++, text: s.text, imageId: s.imageId })) ?? []
  )
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()

  const servingsCount = Math.max(1, Math.round(Number(servings)) || 1)
  const nutrition = computeRecipeBreakdown({
    lines: lines.flatMap((l) => {
      const ingredient = byId.get(l.ingredientId)
      const quantity = Number(l.quantity)
      return ingredient && quantity > 0
        ? [{ grams: toGrams(quantity, l.unit, ingredient), ingredient }]
        : []
    }),
    servings: servingsCount,
    cookedWeightGrams: Number(cookedWeight) > 0 ? Number(cookedWeight) : null,
  })
  const groupNames = [...new Set(lines.map((l) => l.groupName.trim()).filter(Boolean))]

  function updateLine(key: number, patch: Partial<Line>) {
    setLines((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  function pickIngredient(line: Line, ingredientId: string) {
    const units = unitsFor(byId.get(ingredientId))
    updateLine(line.key, { ingredientId, unit: units.includes(line.unit) ? line.unit : 'g' })
  }

  function updateStep(key: number, patch: Partial<Step>) {
    setSteps((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const input: RecipeInput = {
      title,
      description,
      servings: Number(servings),
      cookedWeightGrams: cookedWeight.trim() === '' ? null : Number(cookedWeight),
      tags: tags.split(','),
      coverImageId,
      ingredients: lines.map((l) => ({
        ingredientId: l.ingredientId,
        quantity: Number(l.quantity),
        unit: l.unit,
        groupName: l.groupName,
      })),
      steps: steps.map((s) => ({ text: s.text, imageId: s.imageId })),
    }
    startTransition(async () => {
      const result = recipe ? await updateRecipe(recipe.id, input) : await createRecipe(input)
      if (result.error !== undefined) return setError(result.error)
      toast.success(recipe ? 'Recipe saved' : 'Recipe created')
      router.push(`/recipes/${result.id}`)
    })
  }

  return (
    <form onSubmit={submit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="title">Title</FieldLabel>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </Field>

        <Field>
          <FieldLabel htmlFor="description">Description</FieldLabel>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="servings">Servings</FieldLabel>
            <Input
              id="servings"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={servings}
              onChange={(e) => setServings(e.target.value)}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="cookedWeight">Cooked weight (g)</FieldLabel>
            <Input
              id="cookedWeight"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={cookedWeight}
              onChange={(e) => setCookedWeight(e.target.value)}
              placeholder="Optional"
            />
            <FieldDescription>
              Weigh the finished dish to make per-100 g values accurate.
            </FieldDescription>
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="tags">Tags</FieldLabel>
          <Input
            id="tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="breakfast, quick, vegetarian"
          />
          <FieldDescription>Separate tags with commas.</FieldDescription>
        </Field>

        <Field>
          <FieldLabel>Cover image</FieldLabel>
          <ImagePicker
            imageId={coverImageId}
            onChange={setCoverImageId}
            label="Add cover image"
            className="aspect-video max-w-md"
          />
        </Field>

        <FieldSet>
          <FieldLegend>Ingredients</FieldLegend>
          <FieldDescription>
            Missing one?{' '}
            <Link href="/ingredients/new" target="_blank">
              Add it to the library
            </Link>
            .
          </FieldDescription>
          <datalist id="ingredient-groups">
            {groupNames.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
          {lines.map((line) => {
            const ingredient = byId.get(line.ingredientId)
            return (
              <div
                key={line.key}
                className="grid grid-cols-[1fr_auto_auto] gap-2 rounded-lg border p-2 sm:grid-cols-[minmax(0,2fr)_5.5rem_auto_minmax(0,1fr)_auto]"
              >
                <IngredientPicker
                  library={library}
                  value={line.ingredientId}
                  onChange={(id) => pickIngredient(line, id)}
                  className="col-span-3 sm:col-span-1"
                />
                <Input
                  aria-label="Quantity"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  placeholder="Qty"
                  value={line.quantity}
                  onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                  required
                />
                <Select
                  value={line.unit}
                  onValueChange={(unit) => unit && updateLine(line.key, { unit })}
                >
                  <SelectTrigger aria-label="Unit" className="min-w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {unitsFor(ingredient).map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  aria-label="Group"
                  placeholder="Group (optional)"
                  list="ingredient-groups"
                  value={line.groupName}
                  onChange={(e) => updateLine(line.key, { groupName: e.target.value })}
                  className="order-last col-span-3 sm:order-none sm:col-span-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove ingredient"
                  onClick={() => setLines((rows) => rows.filter((r) => r.key !== line.key))}
                >
                  <X />
                </Button>
              </div>
            )
          })}
          <Button
            type="button"
            variant="outline"
            className="w-fit"
            onClick={() =>
              setLines((rows) => [
                ...rows,
                {
                  key: nextKey++,
                  ingredientId: '',
                  quantity: '',
                  unit: 'g',
                  groupName: rows.at(-1)?.groupName ?? '',
                },
              ])
            }
          >
            <Plus />
            Add ingredient
          </Button>
        </FieldSet>

        <FieldSet>
          <FieldLegend>Steps</FieldLegend>
          {steps.map((step, index) => (
            <div key={step.key} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">Step {index + 1}</span>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Move step up"
                    disabled={index === 0}
                    onClick={() => setSteps((rows) => move(rows, index, index - 1))}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Move step down"
                    disabled={index === steps.length - 1}
                    onClick={() => setSteps((rows) => move(rows, index, index + 1))}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove step"
                    onClick={() => setSteps((rows) => rows.filter((r) => r.key !== step.key))}
                  >
                    <X />
                  </Button>
                </div>
              </div>
              <Textarea
                aria-label={`Step ${index + 1}`}
                value={step.text}
                onChange={(e) => updateStep(step.key, { text: e.target.value })}
                required
              />
              <ImagePicker
                imageId={step.imageId}
                onChange={(imageId) => updateStep(step.key, { imageId })}
                label="Add photo"
                className="aspect-video max-w-xs"
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            className="w-fit"
            onClick={() =>
              setSteps((rows) => [...rows, { key: nextKey++, text: '', imageId: null }])
            }
          >
            <Plus />
            Add step
          </Button>
        </FieldSet>

        <Card size="sm" className="sticky bottom-20 md:bottom-4">
          <CardHeader>
            <CardTitle>Nutrition</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1 text-sm sm:grid-cols-2">
            <div>
              <span className="font-medium">Per serving </span>
              <MacroSummary macros={nutrition.perServing} />
            </div>
            <div>
              <span className="font-medium">Per 100 g </span>
              <MacroSummary macros={nutrition.per100g} />
            </div>
            <div className="text-muted-foreground sm:col-span-2">
              {formatGrams(nutrition.totalGrams)} g of ingredients · {servingsCount}{' '}
              {servingsCount === 1 ? 'serving' : 'servings'}
            </div>
          </CardContent>
        </Card>

        <FieldError>{error}</FieldError>
        <Button type="submit" disabled={pending} className="w-fit">
          {pending ? 'Saving…' : recipe ? 'Save recipe' : 'Create recipe'}
        </Button>
      </FieldGroup>
    </form>
  )
}

function IngredientPicker({
  library,
  value,
  onChange,
  className,
}: {
  library: IngredientWithUnits[]
  value: string
  onChange: (id: string) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = library.find((i) => i.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" className={cn('justify-between font-normal', className)} />
        }
      >
        <span className={selected ? 'truncate' : 'truncate text-muted-foreground'}>
          {selected?.name ?? 'Pick ingredient'}
        </span>
        <ChevronsUpDown className="text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command
          filter={(_value, search, keywords) =>
            keywords?.join(' ').toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }
        >
          <CommandInput placeholder="Search ingredients" />
          <CommandList>
            <CommandEmpty>No ingredient found.</CommandEmpty>
            <CommandGroup>
              {library.map((i) => (
                <CommandItem
                  key={i.id}
                  value={i.id}
                  keywords={[i.name, i.brand ?? '']}
                  data-checked={i.id === value}
                  onSelect={() => {
                    onChange(i.id)
                    setOpen(false)
                  }}
                >
                  <div className="min-w-0">
                    <div className="truncate">
                      {i.name}
                      {i.brand && <span className="text-muted-foreground"> · {i.brand}</span>}
                    </div>
                    <MacroSummary macros={i} className="text-xs" />
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function ImagePicker({
  imageId,
  onChange,
  label,
  className,
}: {
  imageId: string | null
  onChange: (imageId: string | null) => void
  label: string
  className: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()

  function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const form = new FormData()
    form.set('file', file)
    startTransition(async () => {
      const result = await uploadRecipeImage(form)
      if (result.error !== undefined) return void toast.error(result.error)
      onChange(result.id)
    })
  }

  return (
    <div className="space-y-2">
      {imageId && (
        <div className={cn('relative overflow-hidden rounded-lg bg-muted', className)}>
          <Image src={`/api/images/${imageId}`} alt="" fill unoptimized className="object-cover" />
        </div>
      )}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => input.current?.click()}
        >
          <ImagePlus />
          {pending ? 'Uploading…' : imageId ? 'Replace' : label}
        </Button>
        {imageId && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            Remove
          </Button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" hidden onChange={upload} />
    </div>
  )
}
