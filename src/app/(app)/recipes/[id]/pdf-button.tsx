'use client'

import { FileDown } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { useT } from '@/i18n/client'
import { useServings } from './servings-context'

export function PdfButton({ recipeId }: { recipeId: string }) {
  const t = useT()
  const { servings, mode } = useServings()
  return (
    <a
      href={`/api/recipes/${recipeId}/pdf?servings=${servings}&mode=${mode}`}
      className={buttonVariants({ variant: 'ghost' })}
    >
      <FileDown />
      {t.pdf.download}
    </a>
  )
}
