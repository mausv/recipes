'use client'

import { Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatGrams, formatKcal, type Macros, multiplyMacros } from '@/lib/nutrition'
import { formatQuantity } from '@/lib/units'

type Line = {
  id: string
  quantity: number
  unit: string
  grams: number
  groupName: string | null
  ingredient: { name: string; brand: string | null }
  macros: Macros
}

const rows = [
  { key: 'kcal', label: 'Calories', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Carbs', unit: 'g' },
  { key: 'fat', label: 'Fat', unit: 'g' },
  { key: 'fiber', label: 'Fiber', unit: 'g' },
] as const

function format(key: keyof Macros, value: number) {
  return key === 'kcal' ? formatKcal(value) : formatGrams(value)
}

export function RecipeBody({
  baseServings,
  lines,
  nutrition,
  steps,
}: {
  baseServings: number
  lines: Line[]
  nutrition: { total: Macros; perServing: Macros; per100g: Macros }
  steps: React.ReactNode
}) {
  const [servings, setServings] = useState(baseServings)
  const factor = servings / baseServings

  const groups = new Map<string | null, Line[]>()
  for (const line of lines) {
    groups.set(line.groupName, [...(groups.get(line.groupName) ?? []), line])
  }

  const columns = [
    { label: 'Per serving', macros: nutrition.perServing },
    { label: 'Per 100 g', macros: nutrition.per100g },
    { label: 'Total', macros: multiplyMacros(nutrition.total, factor) },
  ]

  return (
    <>
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">Ingredients</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Fewer servings"
              disabled={servings <= 1}
              onClick={() => setServings((s) => s - 1)}
            >
              <Minus />
            </Button>
            <span className="min-w-20 text-center text-sm tabular-nums">
              {servings} {servings === 1 ? 'serving' : 'servings'}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="More servings"
              onClick={() => setServings((s) => s + 1)}
            >
              <Plus />
            </Button>
          </div>
        </div>
        {lines.length === 0 && <p className="text-muted-foreground">No ingredients yet.</p>}
        {[...groups].map(([group, groupLines]) => (
          <div key={group ?? ''} className="space-y-2">
            {group && <h3 className="font-medium">{group}</h3>}
            <ul className="divide-y rounded-lg border">
              {groupLines.map((line) => (
                <li key={line.id} className="flex items-baseline justify-between gap-4 px-3 py-2">
                  <span>
                    <span className="font-medium tabular-nums">
                      {formatQuantity(line.quantity * factor)} {line.unit}
                    </span>{' '}
                    {line.ingredient.name}
                    {line.ingredient.brand && (
                      <span className="text-muted-foreground"> · {line.ingredient.brand}</span>
                    )}
                  </span>
                  {line.unit !== 'g' && (
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {formatGrams(line.grams * factor)} g
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {steps}

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Nutrition</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead />
              {columns.map((c) => (
                <TableHead key={c.label} className="text-right">
                  {c.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell className="font-medium">{row.label}</TableCell>
                {columns.map((c) => (
                  <TableCell key={c.label} className="text-right tabular-nums">
                    {format(row.key, c.macros[row.key])} {row.unit}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {lines.length > 0 && (
          <details className="group rounded-lg border">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
              Per-ingredient breakdown
            </summary>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ingredient</TableHead>
                  <TableHead className="text-right">Weight</TableHead>
                  {rows.slice(0, 4).map((row) => (
                    <TableHead key={row.key} className="text-right">
                      {row.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => {
                  const macros = multiplyMacros(line.macros, factor)
                  return (
                    <TableRow key={line.id}>
                      <TableCell>{line.ingredient.name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatGrams(line.grams * factor)} g
                      </TableCell>
                      {rows.slice(0, 4).map((row) => (
                        <TableCell key={row.key} className="text-right tabular-nums">
                          {format(row.key, macros[row.key])}
                        </TableCell>
                      ))}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </details>
        )}
      </section>
    </>
  )
}
