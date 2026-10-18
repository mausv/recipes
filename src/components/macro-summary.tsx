'use client'

import { useT } from '@/i18n/client'
import { formatGrams, formatKcal, type Macros } from '@/lib/nutrition'
import { cn } from '@/lib/utils'

export function MacroSummary({
  macros,
  className,
}: {
  macros: Omit<Macros, 'fiber'>
  className?: string
}) {
  const t = useT()
  return (
    <span className={cn('text-muted-foreground tabular-nums', className)}>
      {t.recipes.macroSummary(
        formatKcal(macros.kcal),
        formatGrams(macros.protein),
        formatGrams(macros.carbs),
        formatGrams(macros.fat)
      )}
    </span>
  )
}
