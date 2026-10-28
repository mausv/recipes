'use client'

import { ChevronDown, ChevronsUpDown, ChevronUp, ImagePlus, Plus, X } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createRecipe, updateRecipe, uploadRecipeImage } from '@/actions/recipes'
import { Figures, MacroFigures } from '@/components/macro-figures'
import { MacroSummary } from '@/components/macro-summary'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
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
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useLocale, useT, useTError } from '@/i18n/client'
import { unitLabel } from '@/i18n/format'
import type { IngredientWithUnits } from '@/lib/ingredients'
import { computeRecipeBreakdown, formatGrams } from '@/lib/nutrition'
import { builtInUnitsFor, isKnownUnit, toGrams } from '@/lib/units'
import { cn, move } from '@/lib/utils'
import type { RecipeInput } from '@/lib/validation/recipe'

type Line = {
  key: number
  ingredientId: string
  quantity: string
  unit: string
  groupName: string
  showGroup: boolean
}
type Focus = { x: number; y: number }
type Step = { key: number; text: string; imageId: string | null; focus: Focus }

const CENTER: Focus = { x: 50, y: 50 }

let nextKey = 0

function unitGroups(ingredient: IngredientWithUnits | undefined) {
  const custom = ingredient?.units ?? []
  const builtIn = builtInUnitsFor(custom)
  return (
    [
      { key: 'weight', units: builtIn.filter((u) => u.kind === 'weight') },
      { key: 'volume', units: builtIn.filter((u) => u.kind === 'volume') },
      { key: 'ingredientUnits', units: custom },
    ] as const
  ).filter((group) => group.units.length)
}

export function RecipeForm({
  library,
  recipe,
}: {
  library: IngredientWithUnits[]
  recipe?: RecipeInput & { id: string }
}) {
  const router = useRouter()
  const t = useT()
  const tError = useTError()
  const locale = useLocale()
  const byId = new Map(library.map((i) => [i.id, i]))

  const [title, setTitle] = useState(recipe?.title ?? '')
  const [description, setDescription] = useState(recipe?.description ?? '')
  const [servings, setServings] = useState(String(recipe?.servings ?? 2))
  const [cookedWeight, setCookedWeight] = useState(
    recipe?.cookedWeightGrams ? String(recipe.cookedWeightGrams) : ''
  )
  const [tags, setTags] = useState(recipe?.tags ?? [])
  const [tagDraft, setTagDraft] = useState('')
  const [coverImageId, setCoverImageId] = useState(recipe?.coverImageId ?? null)
  const [coverFocus, setCoverFocus] = useState<Focus>({
    x: recipe?.coverFocusX ?? 50,
    y: recipe?.coverFocusY ?? 50,
  })
  const [lines, setLines] = useState<Line[]>(
    () =>
      recipe?.ingredients.map((l) => ({
        key: nextKey++,
        ingredientId: l.ingredientId,
        quantity: String(l.quantity),
        unit: l.unit,
        groupName: l.groupName ?? '',
        showGroup: Boolean(l.groupName),
      })) ?? []
  )
  const [steps, setSteps] = useState<Step[]>(
    () =>
      recipe?.steps.map((s) => ({
        key: nextKey++,
        text: s.text,
        imageId: s.imageId,
        focus: { x: s.imageFocusX ?? 50, y: s.imageFocusY ?? 50 },
      })) ?? []
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
  const cancelHref = recipe ? `/recipes/${recipe.id}` : '/'
  const saveLabel = pending ? t.recipes.saving : t.recipes.saveRecipe

  function updateLine(key: number, patch: Partial<Line>) {
    setLines((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  function pickIngredient(line: Line, ingredientId: string) {
    const units = byId.get(ingredientId)?.units ?? []
    updateLine(line.key, { ingredientId, unit: isKnownUnit(line.unit, units) ? line.unit : 'g' })
  }

  function updateStep(key: number, patch: Partial<Step>) {
    setSteps((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  function commitTag() {
    const tag = tagDraft.trim().toLowerCase()
    if (tag && !tags.includes(tag)) setTags([...tags, tag])
    setTagDraft('')
  }

  function tagKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      commitTag()
    } else if (event.key === 'Backspace' && tagDraft === '') {
      setTags(tags.slice(0, -1))
    }
  }

  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const input: RecipeInput = {
      title,
      description,
      servings: Number(servings),
      cookedWeightGrams: cookedWeight.trim() === '' ? null : Number(cookedWeight),
      tags: [...tags, tagDraft],
      coverImageId,
      coverFocusX: coverFocus.x,
      coverFocusY: coverFocus.y,
      ingredients: lines.map((l) => ({
        ingredientId: l.ingredientId,
        quantity: Number(l.quantity),
        unit: l.unit,
        groupName: l.groupName,
      })),
      steps: steps.map((s) => ({
        text: s.text,
        imageId: s.imageId,
        imageFocusX: s.focus.x,
        imageFocusY: s.focus.y,
      })),
    }
    startTransition(async () => {
      const result = recipe ? await updateRecipe(recipe.id, input) : await createRecipe(input)
      if (result.error !== undefined) {
        setError(result.error)
        toast.error(tError(result.error))
        return
      }
      toast.success(recipe ? t.recipes.recipeSaved : t.recipes.recipeCreated)
      router.push(`/recipes/${result.id}`)
    })
  }

  return (
    <form onSubmit={submit} className="pb-16 lg:pb-0">
      <div className="mb-8 flex items-center justify-between gap-4 bg-background md:sticky md:top-14 md:z-30 md:-mt-4 md:mb-10 md:border-b md:py-4">
        <h1 className="text-[32px] leading-tight tracking-[-0.01em]">
          {recipe ? t.recipes.editRecipe : t.recipes.newRecipe}
        </h1>
        <div className="hidden items-center gap-1 md:flex">
          <Link href={cancelHref} className={buttonVariants({ variant: 'ghost' })}>
            {t.common.cancel}
          </Link>
          <Button type="submit" disabled={pending}>
            {saveLabel}
          </Button>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-x-14">
        <div className="min-w-0 space-y-10 md:space-y-14">
          <section className="space-y-5">
            <h2 className="text-2xl">{t.recipes.basics}</h2>
            <Field>
              <FieldLabel htmlFor="title">{t.recipes.titleLabel}</FieldLabel>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t.recipes.titlePlaceholder}
                required
                className="h-14 font-heading text-2xl sm:h-14"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="description">{t.recipes.description}</FieldLabel>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t.recipes.optional}
              />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="servings">{t.recipes.servings}</FieldLabel>
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
                <FieldLabel htmlFor="cookedWeight">{t.recipes.cookedWeight}</FieldLabel>
                <Input
                  id="cookedWeight"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={cookedWeight}
                  onChange={(e) => setCookedWeight(e.target.value)}
                  placeholder={t.recipes.optional}
                />
                <FieldDescription>{t.recipes.cookedWeightHint}</FieldDescription>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="tags">{t.recipes.tags}</FieldLabel>
              <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border border-input px-2 py-1.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 sm:min-h-10 dark:bg-input/30">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="flex h-7 items-center gap-0.5 rounded-full bg-secondary pr-0.5 pl-2.5 text-[13px] text-secondary-foreground"
                  >
                    {tag}
                    <button
                      type="button"
                      aria-label={t.recipes.removeTag(tag)}
                      onClick={() => setTags(tags.filter((other) => other !== tag))}
                      className="relative flex size-6 items-center justify-center rounded-full text-muted-foreground after:absolute after:-inset-2 hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  </span>
                ))}
                <input
                  id="tags"
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={tagKey}
                  onBlur={commitTag}
                  placeholder={tags.length ? '' : t.recipes.tagsPlaceholder}
                  className="h-7 min-w-24 flex-1 bg-transparent px-1 text-base outline-none placeholder:text-muted-foreground"
                />
              </div>
              <FieldDescription>{t.recipes.tagsHint}</FieldDescription>
            </Field>
          </section>

          <section className="space-y-5">
            <h2 className="text-2xl">{t.recipes.photo}</h2>
            <CoverPicker
              imageId={coverImageId}
              focus={coverFocus}
              onChange={(imageId) => {
                setCoverImageId(imageId)
                setCoverFocus(CENTER)
              }}
              onFocusChange={setCoverFocus}
            />
          </section>

          <section className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-2xl">{t.recipes.ingredients}</h2>
              <p className="text-sm text-muted-foreground">
                {t.recipes.missingIngredient}{' '}
                <Link
                  href="/ingredients/new"
                  target="_blank"
                  className="text-primary underline underline-offset-4"
                >
                  {t.recipes.addToLibrary}
                </Link>
                .
              </p>
            </div>
            <datalist id="ingredient-groups">
              {groupNames.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
            {lines.length > 0 && (
              <div className="hidden grid-cols-[80px_120px_minmax(0,1fr)_160px_40px] gap-x-2 text-[13px] text-muted-foreground sm:grid">
                <span>{t.recipes.quantity}</span>
                <span>{t.recipes.unit}</span>
                <span>{t.recipes.ingredient}</span>
                <span>{t.recipes.group}</span>
              </div>
            )}
            <ul className="divide-y sm:divide-y-0">
              {lines.map((line) => {
                const ingredient = byId.get(line.ingredientId)
                return (
                  <li
                    key={line.key}
                    className="grid grid-cols-[88px_minmax(0,1fr)_44px] gap-2 py-3 first:pt-0 sm:grid-cols-[80px_120px_minmax(0,1fr)_160px_40px] sm:py-1"
                  >
                    <Input
                      aria-label={t.recipes.quantity}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      placeholder={t.recipes.quantityShort}
                      value={line.quantity}
                      onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                      required
                    />
                    <Select
                      value={line.unit}
                      onValueChange={(unit) => unit && updateLine(line.key, { unit })}
                    >
                      <SelectTrigger aria-label={t.recipes.unit} className="w-full">
                        <SelectValue>{(unit: string) => unitLabel(unit, locale)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {unitGroups(ingredient).map((group) => (
                          <SelectGroup key={group.key}>
                            <SelectLabel>{t.recipes[group.key]}</SelectLabel>
                            {group.units.map((u) => (
                              <SelectItem key={u.name} value={u.name}>
                                {unitLabel(u.name, locale)}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                    <IngredientPicker
                      library={library}
                      value={line.ingredientId}
                      onChange={(id) => pickIngredient(line, id)}
                      className="col-span-3 sm:col-span-1"
                    />
                    <Input
                      aria-label={t.recipes.group}
                      placeholder={t.recipes.group}
                      list="ingredient-groups"
                      value={line.groupName}
                      onChange={(e) => updateLine(line.key, { groupName: e.target.value })}
                      className={cn(
                        'col-span-3 sm:col-span-1 sm:block',
                        !line.showGroup && 'hidden'
                      )}
                    />
                    {!line.showGroup && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="col-span-3 -ml-3.5 w-fit text-muted-foreground sm:hidden"
                        onClick={() => updateLine(line.key, { showGroup: true })}
                      >
                        <Plus />
                        {t.recipes.addGroup}
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t.recipes.removeIngredient}
                      className="col-start-3 row-start-1 text-muted-foreground sm:col-start-5"
                      onClick={() => setLines((rows) => rows.filter((r) => r.key !== line.key))}
                    >
                      <X />
                    </Button>
                  </li>
                )
              })}
            </ul>
            <Button
              type="button"
              variant="ghost"
              className="-ml-4 text-primary hover:text-primary sm:-ml-3.5"
              onClick={() =>
                setLines((rows) => {
                  const groupName = rows.at(-1)?.groupName ?? ''
                  return [
                    ...rows,
                    {
                      key: nextKey++,
                      ingredientId: '',
                      quantity: '',
                      unit: 'g',
                      groupName,
                      showGroup: Boolean(groupName),
                    },
                  ]
                })
              }
            >
              <Plus />
              {t.recipes.addIngredient}
            </Button>
          </section>

          <section className="space-y-6">
            <h2 className="text-2xl">{t.recipes.steps}</h2>
            <ol className="space-y-6">
              {steps.map((step, index) => (
                <li key={step.key} className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3">
                  <span className="pt-1.5 font-heading text-[28px] leading-none font-medium text-primary tabular-nums">
                    {index + 1}
                  </span>
                  <div className="space-y-2">
                    <Textarea
                      aria-label={t.recipes.step(index + 1)}
                      value={step.text}
                      onChange={(e) => updateStep(step.key, { text: e.target.value })}
                      className="text-[17px] leading-[1.65]"
                      required
                    />
                    <div className="flex items-start justify-between gap-2">
                      <StepPhoto
                        imageId={step.imageId}
                        focus={step.focus}
                        onChange={(imageId) => updateStep(step.key, { imageId, focus: CENTER })}
                        onFocusChange={(focus) => updateStep(step.key, { focus })}
                      />
                      <div className="flex shrink-0 text-muted-foreground">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t.recipes.moveStepUp}
                          disabled={index === 0}
                          onClick={() => setSteps((rows) => move(rows, index, index - 1))}
                        >
                          <ChevronUp />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t.recipes.moveStepDown}
                          disabled={index === steps.length - 1}
                          onClick={() => setSteps((rows) => move(rows, index, index + 1))}
                        >
                          <ChevronDown />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t.recipes.removeStep}
                          onClick={() => setSteps((rows) => rows.filter((r) => r.key !== step.key))}
                        >
                          <X />
                        </Button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            <Button
              type="button"
              variant="ghost"
              className="-ml-4 text-primary hover:text-primary sm:-ml-3.5"
              onClick={() =>
                setSteps((rows) => [
                  ...rows,
                  { key: nextKey++, text: '', imageId: null, focus: CENTER },
                ])
              }
            >
              <Plus />
              {t.recipes.addStep}
            </Button>
          </section>

          <div className="space-y-4 border-t pt-6">
            <FieldError>{error && tError(error)}</FieldError>
            <div className="flex items-center justify-end gap-1">
              <Link href={cancelHref} className={buttonVariants({ variant: 'ghost' })}>
                {t.common.cancel}
              </Link>
              <Button type="submit" disabled={pending}>
                {saveLabel}
              </Button>
            </div>
          </div>
        </div>

        <aside aria-label={t.recipes.nutrition} className="hidden lg:block">
          <div className="sticky top-40 space-y-4">
            <h2 className="text-2xl">{t.recipes.nutrition}</h2>
            <MacroFigures
              perServing={nutrition.perServing}
              per100g={nutrition.per100g}
              figuresClassName="grid-cols-2 gap-y-6"
            />
            <p className="text-[13px] text-muted-foreground tabular-nums">
              {t.recipes.nutritionFrom(formatGrams(nutrition.totalGrams), servingsCount)}
            </p>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t bg-background md:bottom-0 md:pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="mx-auto flex max-w-[1040px] items-center gap-4 px-4 py-2.5 md:px-6">
          <span className="w-16 shrink-0 text-[13px] leading-tight text-muted-foreground">
            {t.recipes.perServing}
          </span>
          <Figures macros={nutrition.perServing} size="sm" className="min-w-0 flex-1" />
        </div>
      </div>
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
  const t = useT()
  const [open, setOpen] = useState(false)
  const selected = library.find((i) => i.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className={cn(
              'justify-between rounded-lg border-input px-3 text-base font-normal sm:h-10 sm:px-3 sm:text-sm',
              className
            )}
          />
        }
      >
        <span className={selected ? 'truncate' : 'truncate text-muted-foreground'}>
          {selected?.name ?? t.recipes.pickIngredient}
        </span>
        <ChevronsUpDown className="text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-80 max-w-[calc(100vw-2rem)] p-0" align="start">
        <Command
          filter={(_value, search, keywords) =>
            keywords?.join(' ').toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }
        >
          <CommandInput placeholder={t.recipes.searchIngredients} />
          <CommandList>
            <CommandEmpty>{t.recipes.noIngredientFound}</CommandEmpty>
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
                      {i.brand && <span className="text-muted-foreground">, {i.brand}</span>}
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

function useImageUpload(onChange: (imageId: string) => void) {
  const tError = useTError()
  const input = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()

  function upload(file: File | undefined) {
    if (!file) return
    const form = new FormData()
    form.set('file', file)
    startTransition(async () => {
      const result = await uploadRecipeImage(form)
      if (result.error !== undefined) return void toast.error(tError(result.error))
      onChange(result.id)
    })
  }

  return {
    pending,
    upload,
    pick: () => input.current?.click(),
    fileInput: (
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          upload(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    ),
  }
}

function objectPosition({ x, y }: Focus) {
  return { objectPosition: `${x}% ${y}%` }
}

function FocusDialog({
  imageId,
  focus,
  onChange,
}: {
  imageId: string
  focus: Focus
  onChange: (focus: Focus) => void
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(focus)
  const [ratio, setRatio] = useState(4 / 3)
  const src = `/api/images/${imageId}`

  function place(event: React.PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    const percent = (offset: number, size: number) =>
      Math.round(Math.min(100, Math.max(0, (offset / size) * 100)))
    setDraft({
      x: percent(event.clientX - box.left, box.width),
      y: percent(event.clientY - box.top, box.height),
    })
  }

  function nudge(event: React.KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 10 : 1
    const moves: Record<string, Focus> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    setDraft((current) => ({
      x: Math.min(100, Math.max(0, current.x + move.x)),
      y: Math.min(100, Math.max(0, current.y + move.y)),
    }))
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(focus)
        setOpen(next)
      }}
    >
      <DialogTrigger render={<Button type="button" variant="ghost" size="sm" />}>
        {t.recipes.adjust}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">{t.recipes.focusTitle}</DialogTitle>
          <DialogDescription>{t.recipes.focusHint}</DialogDescription>
        </DialogHeader>
        <div
          role="slider"
          tabIndex={0}
          aria-label={t.recipes.focusPoint}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={draft.x}
          aria-valuetext={t.recipes.focusValue(draft.x, draft.y)}
          className="relative mx-auto cursor-crosshair touch-none overflow-hidden rounded-lg bg-secondary outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50"
          style={{ aspectRatio: ratio, width: `min(100%, 50vh * ${ratio})` }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId)
            place(event)
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) place(event)
          }}
          onKeyDown={nudge}
        >
          <Image
            src={src}
            alt=""
            fill
            unoptimized
            draggable={false}
            className="object-contain"
            onLoad={(event) =>
              setRatio(event.currentTarget.naturalWidth / event.currentTarget.naturalHeight)
            }
          />
          <span
            aria-hidden
            className="pointer-events-none absolute size-7 -translate-1/2 rounded-full border-2 border-white bg-white/20 shadow-[0_0_0_1px_rgb(0_0_0/0.4),0_1px_4px_rgb(0_0_0/0.4)]"
            style={{ left: `${draft.x}%`, top: `${draft.y}%` }}
          />
        </div>
        <div className="space-y-2">
          <p className="text-[13px] text-muted-foreground">{t.recipes.focusPreview}</p>
          <div className="grid grid-cols-[minmax(0,16fr)_minmax(0,9fr)] items-end gap-3">
            {[
              { label: t.recipes.previewWide, aspect: 'aspect-video' },
              { label: t.recipes.previewStandard, aspect: 'aspect-4/3' },
            ].map((frame) => (
              <figure key={frame.aspect} className="space-y-1">
                <div
                  className={cn('relative overflow-hidden rounded-md bg-secondary', frame.aspect)}
                >
                  <Image
                    src={src}
                    alt=""
                    fill
                    unoptimized
                    className="object-cover"
                    style={objectPosition(draft)}
                  />
                </div>
                <figcaption className="text-[13px] text-muted-foreground">{frame.label}</figcaption>
              </figure>
            ))}
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            {t.common.cancel}
          </DialogClose>
          <Button
            type="button"
            onClick={() => {
              onChange(draft)
              setOpen(false)
            }}
          >
            {t.recipes.done}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CoverPicker({
  imageId,
  focus,
  onChange,
  onFocusChange,
}: {
  imageId: string | null
  focus: Focus
  onChange: (imageId: string | null) => void
  onFocusChange: (focus: Focus) => void
}) {
  const t = useT()
  const { pending, upload, pick, fileInput } = useImageUpload(onChange)

  return (
    <div
      className="max-w-md space-y-2"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        upload(e.dataTransfer.files[0])
      }}
    >
      {imageId ? (
        <>
          <div className="relative aspect-4/3 overflow-hidden rounded-lg bg-secondary">
            <Image
              src={`/api/images/${imageId}`}
              alt={t.recipes.coverPhoto}
              fill
              unoptimized
              className="object-cover"
              style={objectPosition(focus)}
            />
          </div>
          <div className="-ml-3.5 flex gap-1">
            <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={pick}>
              {pending ? t.recipes.uploading : t.recipes.replace}
            </Button>
            <FocusDialog imageId={imageId} focus={focus} onChange={onFocusChange} />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => onChange(null)}
            >
              {t.recipes.remove}
            </Button>
          </div>
        </>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={pick}
          className="flex aspect-4/3 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
        >
          <ImagePlus className="size-6" />
          <span>{pending ? t.recipes.uploading : t.recipes.addAPhoto}</span>
          <span className="text-[13px]">{t.recipes.dropPhoto}</span>
        </button>
      )}
      {fileInput}
    </div>
  )
}

function StepPhoto({
  imageId,
  focus,
  onChange,
  onFocusChange,
}: {
  imageId: string | null
  focus: Focus
  onChange: (imageId: string | null) => void
  onFocusChange: (focus: Focus) => void
}) {
  const t = useT()
  const { pending, pick, fileInput } = useImageUpload(onChange)

  return (
    <div className="min-w-0 space-y-2">
      {imageId && (
        <div className="relative aspect-4/3 w-48 max-w-full overflow-hidden rounded-lg bg-secondary">
          <Image
            src={`/api/images/${imageId}`}
            alt=""
            fill
            unoptimized
            className="object-cover"
            style={objectPosition(focus)}
          />
        </div>
      )}
      <div className="-ml-3.5 flex flex-wrap">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-primary hover:text-primary"
          disabled={pending}
          onClick={pick}
        >
          {pending ? t.recipes.uploading : imageId ? t.recipes.replacePhoto : t.recipes.addPhoto}
        </Button>
        {imageId && (
          <>
            <FocusDialog imageId={imageId} focus={focus} onChange={onFocusChange} />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => onChange(null)}
            >
              {t.recipes.remove}
            </Button>
          </>
        )}
      </div>
      {fileInput}
    </div>
  )
}
