'use client'

import { useState } from 'react'
import { useT } from '@/i18n/client'
import { formatGrams, formatKcal, type Macros } from '@/lib/nutrition'
import { cn } from '@/lib/utils'

const figures = ['kcal', 'protein', 'carbs', 'fat'] as const

const bases = ['perServing', 'per100g'] as const

export function Figures({
  macros,
  size,
  className,
}: {
  macros: Macros
  size: 'lg' | 'sm'
  className?: string
}) {
  const t = useT()
  return (
    <dl className={cn('grid grid-cols-4', size === 'lg' ? 'gap-x-3' : 'gap-x-2', className)}>
      {figures.map((key) => (
        <div key={key} className="flex min-w-0 flex-col-reverse gap-1">
          <dt className="text-[13px] leading-none text-muted-foreground">
            {t.recipes.figures[key]}
          </dt>
          <dd
            className={cn(
              'font-heading leading-none font-medium whitespace-nowrap tabular-nums',
              size === 'lg' ? 'text-[28px]' : 'text-xl'
            )}
          >
            {key === 'kcal' ? (
              <span
                className={cn(
                  'underline decoration-butter [text-decoration-skip-ink:none]',
                  size === 'lg'
                    ? 'decoration-[5px] underline-offset-[5px]'
                    : 'decoration-[3px] underline-offset-[3px]'
                )}
              >
                {formatKcal(macros.kcal)}
              </span>
            ) : (
              <>
                {formatGrams(macros[key])}
                <span className="ml-0.5 font-sans text-[13px] text-muted-foreground">g</span>
              </>
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function MacroFigures({
  perServing,
  per100g,
  figuresClassName,
}: {
  perServing: Macros
  per100g: Macros
  figuresClassName?: string
}) {
  const t = useT()
  const [basis, setBasis] = useState<'perServing' | 'per100g'>('perServing')
  const macros = basis === 'perServing' ? perServing : per100g

  return (
    <section aria-label={t.recipes.nutrition} className="space-y-5">
      <div
        role="group"
        aria-label={t.recipes.nutritionBasis}
        className="inline-flex h-11 rounded-full border p-0.5 sm:h-9"
      >
        {bases.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={basis === key}
            onClick={() => setBasis(key)}
            className={cn(
              'rounded-full px-3.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground',
              basis === key && 'bg-secondary text-foreground'
            )}
          >
            {t.recipes[key]}
          </button>
        ))}
      </div>
      <Figures macros={macros} size="lg" className={figuresClassName} />
      <p className="text-[13px] text-muted-foreground tabular-nums">
        {t.recipes.fiber(formatGrams(macros.fiber))}
      </p>
    </section>
  )
}
