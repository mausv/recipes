import { formatGrams, formatKcal, type Macros } from '@/lib/nutrition'
import { cn } from '@/lib/utils'

export function MacroSummary({
  macros,
  className,
}: {
  macros: Omit<Macros, 'fiber'>
  className?: string
}) {
  return (
    <span className={cn('text-muted-foreground tabular-nums', className)}>
      {formatKcal(macros.kcal)} kcal, {formatGrams(macros.protein)} g protein,{' '}
      {formatGrams(macros.carbs)} g carbs, {formatGrams(macros.fat)} g fat
    </span>
  )
}
