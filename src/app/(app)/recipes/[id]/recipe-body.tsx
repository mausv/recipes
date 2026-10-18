'use client'

import { ChevronDown, Minus, Plus } from 'lucide-react'
import { MacroFigures } from '@/components/macro-figures'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useLocale, useT } from '@/i18n/client'
import { unitLabel } from '@/i18n/format'
import { formatGrams, formatKcal, type Macros, multiplyMacros } from '@/lib/nutrition'
import { formatQuantity } from '@/lib/units'
import { cn } from '@/lib/utils'
import { useServings } from './servings-context'

type Line = {
  id: string
  quantity: number
  unit: string
  grams: number
  groupName: string | null
  ingredient: { name: string; brand: string | null }
  macros: Macros
}

const columns = ['kcal', 'protein', 'carbs', 'fat'] as const

const modes = ['scale', 'split'] as const

function format(key: keyof Macros, value: number) {
  return key === 'kcal' ? formatKcal(value) : formatGrams(value)
}

export function RecipeBody({
  baseServings,
  lines,
  nutrition,
  steps,
  children,
}: {
  baseServings: number
  lines: Line[]
  nutrition: { total: Macros; per100g: Macros }
  steps: React.ReactNode
  children: React.ReactNode
}) {
  const t = useT()
  const locale = useLocale()
  const { servings, setServings, mode, setMode } = useServings()
  const factor = mode === 'scale' ? servings / baseServings : 1
  const total = multiplyMacros(nutrition.total, factor)
  const perServing = multiplyMacros(total, 1 / servings)

  const groups = new Map<string | null, Line[]>()
  for (const line of lines) {
    groups.set(line.groupName, [...(groups.get(line.groupName) ?? []), line])
  }

  return (
    <div className="mt-10 grid gap-10 md:mt-14 md:gap-14 lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-x-16">
      <div className="space-y-10 lg:sticky lg:top-20 lg:-m-1 lg:max-h-[calc(100dvh-6rem)] lg:self-start lg:overflow-y-auto lg:p-1">
        <div className="space-y-4">
          <div
            role="group"
            aria-label={t.recipes.servingsMode}
            className="inline-flex h-11 rounded-full border p-0.5 sm:h-9"
          >
            {modes.map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={mode === key}
                onClick={() => setMode(key)}
                className={cn(
                  'rounded-full px-3.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground',
                  mode === key && 'bg-secondary text-foreground'
                )}
              >
                {t.recipes[key]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <div className="mr-auto">
              <span id="servings-label">{t.recipes.servings}</span>
              <p className="text-[13px] text-muted-foreground tabular-nums">
                {mode === 'scale'
                  ? t.recipes.kcalTotal(formatKcal(total.kcal))
                  : t.recipes.kcalBatch(formatKcal(total.kcal))}
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              aria-label={t.recipes.fewerServings}
              disabled={servings <= 1}
              onClick={() => setServings((s) => s - 1)}
            >
              <Minus />
            </Button>
            <output
              aria-labelledby="servings-label"
              aria-live="polite"
              className="min-w-8 text-center font-heading text-2xl font-medium tabular-nums"
            >
              {servings}
            </output>
            <Button
              variant="outline"
              size="icon"
              aria-label={t.recipes.moreServings}
              onClick={() => setServings((s) => s + 1)}
            >
              <Plus />
            </Button>
          </div>
        </div>

        <MacroFigures perServing={perServing} per100g={nutrition.per100g} />

        <section className="space-y-3">
          <h2 className="text-2xl">{t.recipes.ingredients}</h2>
          {lines.length === 0 && <p className="text-muted-foreground">{t.recipes.noIngredients}</p>}
          {[...groups].map(([group, groupLines]) => (
            <div key={group ?? ''}>
              {group && <h3 className="pt-4 pb-1 text-[19px] font-normal italic">{group}</h3>}
              <ul className="divide-y">
                {groupLines.map((line) => (
                  <li
                    key={line.id}
                    className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-baseline gap-x-3 py-2.5"
                  >
                    <span className="font-semibold tabular-nums">
                      {formatQuantity(line.quantity * factor)} {unitLabel(line.unit, locale)}
                    </span>
                    <span>
                      {line.ingredient.name}
                      {line.ingredient.brand && (
                        <span className="block text-[13px] text-muted-foreground">
                          {line.ingredient.brand}
                        </span>
                      )}
                    </span>
                    <span className="text-right text-[13px] text-muted-foreground tabular-nums">
                      {line.unit !== 'g' && `${formatGrams(line.grams * factor)} g`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      </div>

      <div className="min-w-0 space-y-10 md:space-y-14">
        {steps}

        {lines.length > 0 && (
          <details className="group">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 font-heading text-2xl font-medium [&::-webkit-details-marker]:hidden">
              {t.recipes.breakdown}
              <ChevronDown className="size-5 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <p className="mt-2 text-sm text-muted-foreground">
              {mode === 'scale' ? t.recipes.breakdownScaled(servings) : t.recipes.breakdownBatch}
            </p>
            <Table className="mt-3">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-0">{t.recipes.ingredient}</TableHead>
                  <TableHead className="text-right">{t.recipes.weight}</TableHead>
                  {columns.map((key) => (
                    <TableHead key={key} className="text-right">
                      {t.recipes.columns[key]}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => {
                  const macros = multiplyMacros(line.macros, factor)
                  return (
                    <TableRow key={line.id} className="hover:bg-transparent">
                      <TableCell className="pl-0">{line.ingredient.name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatGrams(line.grams * factor)} g
                      </TableCell>
                      {columns.map((key) => (
                        <TableCell key={key} className="text-right tabular-nums">
                          {format(key, macros[key])}
                        </TableCell>
                      ))}
                    </TableRow>
                  )
                })}
              </TableBody>
              <TableFooter className="bg-transparent">
                <TableRow className="hover:bg-transparent">
                  <TableCell className="pl-0">{t.recipes.total}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatGrams(lines.reduce((sum, l) => sum + l.grams, 0) * factor)} g
                  </TableCell>
                  {columns.map((key) => (
                    <TableCell key={key} className="text-right tabular-nums">
                      {format(key, total[key])}
                    </TableCell>
                  ))}
                </TableRow>
              </TableFooter>
            </Table>
          </details>
        )}

        {children}
      </div>
    </div>
  )
}
