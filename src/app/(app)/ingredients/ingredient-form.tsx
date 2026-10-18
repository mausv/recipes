'use client'

import { Plus, Search, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createIngredient, updateIngredient } from '@/actions/ingredients'
import { MacroSummary } from '@/components/macro-summary'
import { Button, buttonVariants } from '@/components/ui/button'
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
import { useT, useTError } from '@/i18n/client'
import type { IngredientWithUnits } from '@/lib/ingredients'
import type { NutritionResult } from '@/lib/nutrition-sources/types'
import type { IngredientInput } from '@/lib/validation/ingredient'
import { SourceBadge } from './source-badge'

type Fields = Record<
  'name' | 'brand' | 'category' | 'kcal' | 'protein' | 'carbs' | 'fat' | 'fiber' | 'density',
  string
>

type UnitRow = { key: number; name: string; grams: string }

let nextKey = 0

function text(n: number | null | undefined) {
  return n == null ? '' : String(n)
}

const macroFields = [
  { name: 'kcal' },
  { name: 'protein' },
  { name: 'carbs' },
  { name: 'fat' },
  { name: 'fiber', optional: true },
] as const

export function IngredientForm({
  ingredient,
  categories,
}: {
  ingredient?: IngredientWithUnits
  categories: string[]
}) {
  const router = useRouter()
  const [fields, setFields] = useState<Fields>({
    name: ingredient?.name ?? '',
    brand: ingredient?.brand ?? '',
    category: ingredient?.category ?? '',
    kcal: text(ingredient?.kcal),
    protein: text(ingredient?.protein),
    carbs: text(ingredient?.carbs),
    fat: text(ingredient?.fat),
    fiber: text(ingredient?.fiber),
    density: text(ingredient?.density ?? 1),
  })
  const [origin, setOrigin] = useState<Pick<IngredientInput, 'source' | 'sourceId'>>({
    source: ingredient?.source ?? 'manual',
    sourceId: ingredient?.sourceId ?? null,
  })
  const [units, setUnits] = useState<UnitRow[]>(
    () => ingredient?.units.map((u) => ({ key: nextKey++, ...u, grams: String(u.grams) })) ?? []
  )
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  const t = useT()
  const tError = useTError()

  function field(name: keyof Fields) {
    return {
      id: name,
      name,
      value: fields[name],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        const { value } = e.target
        setFields((f) => ({ ...f, [name]: value }))
      },
    }
  }

  function updateUnit(key: number, patch: Partial<UnitRow>) {
    setUnits((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  function prefill(result: NutritionResult) {
    const { kcal, protein, carbs, fat, fiber } = result.per100g
    setFields((f) => ({
      ...f,
      name: f.name || result.name,
      brand: f.brand || (result.brand ?? ''),
      kcal: text(kcal),
      protein: text(protein),
      carbs: text(carbs),
      fat: text(fat),
      fiber: text(fiber),
    }))
    setOrigin({ source: result.source, sourceId: result.sourceId })
    toast.success(t.ingredients.filledFrom(result.name))
  }

  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const input: IngredientInput = {
      ...origin,
      name: fields.name,
      brand: fields.brand,
      category: fields.category,
      kcal: Number(fields.kcal),
      protein: Number(fields.protein),
      carbs: Number(fields.carbs),
      fat: Number(fields.fat),
      fiber: fields.fiber.trim() === '' ? null : Number(fields.fiber),
      density: Number(fields.density),
      units: units.map((u) => ({ name: u.name, grams: Number(u.grams) })),
    }
    startTransition(async () => {
      const result = ingredient
        ? await updateIngredient(ingredient.id, input)
        : await createIngredient(input)
      if (result.error !== undefined) return setError(tError(result.error))
      toast.success(ingredient ? t.ingredients.saved : t.ingredients.created)
      router.push('/ingredients')
    })
  }

  return (
    <div className="space-y-10 md:space-y-14">
      <NutritionLookup onPick={prefill} />

      <form onSubmit={submit}>
        <FieldGroup className="gap-10 md:gap-14">
          <div className="grid gap-5 sm:grid-cols-2">
            <h2 className="text-2xl sm:col-span-2">{t.ingredients.details}</h2>
            <Field>
              <FieldLabel htmlFor="name">{t.ingredients.name}</FieldLabel>
              <Input {...field('name')} required />
            </Field>
            <Field>
              <FieldLabel htmlFor="brand">{t.ingredients.brand}</FieldLabel>
              <Input {...field('brand')} placeholder={t.ingredients.optional} />
            </Field>
            <Field>
              <FieldLabel htmlFor="category">{t.ingredients.category}</FieldLabel>
              <Input
                {...field('category')}
                list="ingredient-categories"
                placeholder={t.ingredients.optional}
              />
              <datalist id="ingredient-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <FieldDescription>{t.ingredients.categoryHint}</FieldDescription>
            </Field>
          </div>

          <FieldSet>
            <FieldLegend className="flex items-center gap-3 font-heading text-2xl data-[variant=legend]:text-2xl">
              {t.ingredients.nutritionPer100g} <SourceBadge source={origin.source} />
            </FieldLegend>
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-5">
              {macroFields.map((m) => (
                <Field key={m.name}>
                  <FieldLabel htmlFor={m.name}>{t.ingredients.macroLabels[m.name]}</FieldLabel>
                  <Input
                    {...field(m.name)}
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min={0}
                    required={!('optional' in m)}
                  />
                </Field>
              ))}
            </div>
          </FieldSet>

          <FieldSet>
            <FieldLegend className="font-heading text-2xl data-[variant=legend]:text-2xl">
              {t.ingredients.units}
            </FieldLegend>
            <Field className="sm:max-w-xs">
              <FieldLabel htmlFor="density">{t.ingredients.density}</FieldLabel>
              <Input {...field('density')} type="number" inputMode="decimal" step="any" min={0} />
              <FieldDescription>{t.ingredients.densityHint}</FieldDescription>
            </Field>
            <FieldDescription className="pt-2">{t.ingredients.unitsHint}</FieldDescription>
            {units.map((unit) => (
              <div key={unit.key} className="flex items-center gap-2">
                <Input
                  aria-label={t.ingredients.unitName}
                  placeholder={t.ingredients.unitPlaceholder}
                  value={unit.name}
                  onChange={(e) => updateUnit(unit.key, { name: e.target.value })}
                  required
                />
                <Input
                  aria-label={t.ingredients.gramsPerUnit}
                  placeholder={t.ingredients.gramsPlaceholder}
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min={0}
                  value={unit.grams}
                  onChange={(e) => updateUnit(unit.key, { grams: e.target.value })}
                  required
                  className="w-28"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground"
                  aria-label={t.ingredients.removeUnit}
                  onClick={() => setUnits((rows) => rows.filter((r) => r.key !== unit.key))}
                >
                  <X />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              className="-ml-4 w-fit text-primary hover:text-primary sm:-ml-3.5"
              onClick={() => setUnits((rows) => [...rows, { key: nextKey++, name: '', grams: '' }])}
            >
              <Plus />
              {t.ingredients.addUnit}
            </Button>
          </FieldSet>

          <div className="space-y-4 border-t pt-6">
            <FieldError>{error}</FieldError>
            <div className="flex justify-end gap-1">
              <Link href="/ingredients" className={buttonVariants({ variant: 'ghost' })}>
                {t.common.cancel}
              </Link>
              <Button type="submit" disabled={pending}>
                {pending ? t.ingredients.saving : t.ingredients.saveIngredient}
              </Button>
            </div>
          </div>
        </FieldGroup>
      </form>
    </div>
  )
}

function NutritionLookup({ onPick }: { onPick: (result: NutritionResult) => void }) {
  const [results, setResults] = useState<NutritionResult[]>()
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  const t = useT()

  function search(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const q = String(new FormData(event.currentTarget).get('q')).trim()
    if (!q) return
    startTransition(async () => {
      setError(undefined)
      const res = await fetch(`/api/nutrition/search?q=${encodeURIComponent(q)}`)
      if (!res.ok) return setError(t.ingredients.lookUpFailed)
      const found: NutritionResult[] = await res.json()
      setResults(found)
    })
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-2xl">{t.ingredients.lookUpTitle}</h2>
        <p className="text-sm text-muted-foreground">{t.ingredients.lookUpHint}</p>
      </div>
      <form onSubmit={search} className="flex gap-2">
        <Input
          name="q"
          type="search"
          placeholder={t.ingredients.lookUpPlaceholder}
          aria-label={t.ingredients.search}
          className="rounded-full px-4"
        />
        <Button type="submit" variant="secondary" disabled={pending}>
          <Search />
          {pending ? t.ingredients.searching : t.ingredients.lookUp}
        </Button>
      </form>
      <FieldError>{error}</FieldError>
      {results?.length === 0 && <p className="text-muted-foreground">{t.ingredients.noMatches}</p>}
      {results && results.length > 0 && (
        <ul className="max-h-80 divide-y overflow-y-auto border-y">
          {results.map((r) => (
            <li key={`${r.source}-${r.sourceId}`}>
              <button
                type="button"
                onClick={() => onPick(r)}
                className="flex w-full items-start justify-between gap-3 px-1 py-3 text-left hover:bg-secondary/60"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{r.name}</span>
                  {r.brand && (
                    <span className="block truncate text-[13px] text-muted-foreground">
                      {r.brand}
                    </span>
                  )}
                  <MacroSummary macros={r.per100g} className="text-[13px]" />
                </span>
                <SourceBadge source={r.source} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
