'use client'

import { Plus, Search, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createIngredient, updateIngredient } from '@/actions/ingredients'
import { MacroSummary } from '@/components/macro-summary'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import type { IngredientWithUnits } from '@/lib/ingredients'
import type { NutritionResult } from '@/lib/nutrition-sources/types'
import type { IngredientInput } from '@/lib/validation/ingredient'
import { SourceBadge } from './source-badge'

type Fields = Record<
  'name' | 'brand' | 'kcal' | 'protein' | 'carbs' | 'fat' | 'fiber' | 'density',
  string
>

type UnitRow = { key: number; name: string; grams: string }

let nextKey = 0

function text(n: number | null | undefined) {
  return n == null ? '' : String(n)
}

const macroFields = [
  { name: 'kcal', label: 'Calories (kcal)' },
  { name: 'protein', label: 'Protein (g)' },
  { name: 'carbs', label: 'Carbs (g)' },
  { name: 'fat', label: 'Fat (g)' },
  { name: 'fiber', label: 'Fiber (g)', optional: true },
] as const

export function IngredientForm({ ingredient }: { ingredient?: IngredientWithUnits }) {
  const router = useRouter()
  const [fields, setFields] = useState<Fields>({
    name: ingredient?.name ?? '',
    brand: ingredient?.brand ?? '',
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
    toast.success(`Filled in nutrition from ${result.name}`)
  }

  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const input: IngredientInput = {
      ...origin,
      name: fields.name,
      brand: fields.brand,
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
      if (result.error !== undefined) return setError(result.error)
      toast.success(ingredient ? 'Ingredient saved' : 'Ingredient created')
      router.push('/ingredients')
    })
  }

  return (
    <div className="space-y-6">
      <NutritionLookup onPick={prefill} />

      <form onSubmit={submit}>
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input {...field('name')} required />
            </Field>
            <Field>
              <FieldLabel htmlFor="brand">Brand</FieldLabel>
              <Input {...field('brand')} placeholder="Optional" />
            </Field>
          </div>

          <FieldSet>
            <FieldLegend className="flex items-center gap-2">
              Nutrition per 100 g <SourceBadge source={origin.source} />
            </FieldLegend>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              {macroFields.map((m) => (
                <Field key={m.name}>
                  <FieldLabel htmlFor={m.name}>{m.label}</FieldLabel>
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

          <Field className="sm:max-w-xs">
            <FieldLabel htmlFor="density">Density (g/ml)</FieldLabel>
            <Input {...field('density')} type="number" inputMode="decimal" step="any" min={0} />
            <FieldDescription>Used to convert ml and l to grams. Water is 1.</FieldDescription>
          </Field>

          <FieldSet>
            <FieldLegend>Custom units</FieldLegend>
            <FieldDescription>
              Like “cup”, “slice” or “piece”, with how many grams one weighs.
            </FieldDescription>
            {units.map((unit) => (
              <div key={unit.key} className="flex items-center gap-2">
                <Input
                  aria-label="Unit name"
                  placeholder="cup"
                  value={unit.name}
                  onChange={(e) => updateUnit(unit.key, { name: e.target.value })}
                  required
                />
                <Input
                  aria-label="Grams per unit"
                  placeholder="grams"
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
                  aria-label="Remove unit"
                  onClick={() => setUnits((rows) => rows.filter((r) => r.key !== unit.key))}
                >
                  <X />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              className="w-fit"
              onClick={() => setUnits((rows) => [...rows, { key: nextKey++, name: '', grams: '' }])}
            >
              <Plus />
              Add unit
            </Button>
          </FieldSet>

          <FieldError>{error}</FieldError>
          <Button type="submit" disabled={pending} className="w-fit">
            {pending ? 'Saving…' : ingredient ? 'Save ingredient' : 'Create ingredient'}
          </Button>
        </FieldGroup>
      </form>
    </div>
  )
}

function NutritionLookup({ onPick }: { onPick: (result: NutritionResult) => void }) {
  const [results, setResults] = useState<NutritionResult[]>()
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()

  function search(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const q = String(new FormData(event.currentTarget).get('q')).trim()
    if (!q) return
    startTransition(async () => {
      setError(undefined)
      const res = await fetch(`/api/nutrition/search?q=${encodeURIComponent(q)}`)
      if (!res.ok) return setError('Lookup failed, try again')
      const found: NutritionResult[] = await res.json()
      setResults(found)
    })
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Look up nutrition</CardTitle>
        <CardDescription>Search Open Food Facts and USDA, then pick a match.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <form onSubmit={search} className="flex gap-2">
          <Input name="q" type="search" placeholder="e.g. rolled oats" aria-label="Search" />
          <Button type="submit" variant="secondary" disabled={pending}>
            <Search />
            {pending ? 'Searching…' : 'Look up'}
          </Button>
        </form>
        <FieldError>{error}</FieldError>
        {results?.length === 0 && <p className="text-muted-foreground">No matches.</p>}
        {results && results.length > 0 && (
          <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border">
            {results.map((r) => (
              <li key={`${r.source}-${r.sourceId}`}>
                <button
                  type="button"
                  onClick={() => onPick(r)}
                  className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left hover:bg-muted"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{r.name}</span>
                    {r.brand && (
                      <span className="block truncate text-muted-foreground">{r.brand}</span>
                    )}
                    <MacroSummary macros={r.per100g} className="text-xs" />
                  </span>
                  <SourceBadge source={r.source} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
