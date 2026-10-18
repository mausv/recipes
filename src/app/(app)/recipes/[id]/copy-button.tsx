'use client'

import { Copy } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { copyRecipe } from '@/actions/recipes'
import { Button } from '@/components/ui/button'
import { useT, useTError } from '@/i18n/client'

export function CopyButton({ recipeId }: { recipeId: string }) {
  const router = useRouter()
  const t = useT()
  const tError = useTError()
  const [pending, startTransition] = useTransition()

  function copy() {
    startTransition(async () => {
      const result = await copyRecipe(recipeId)
      if (result.error !== undefined) {
        toast.error(tError(result.error))
        return
      }
      toast.success(t.recipes.copySaved)
      router.push(`/recipes/${result.id}`)
    })
  }

  return (
    <Button variant="ghost" onClick={copy} disabled={pending}>
      <Copy />
      {pending ? t.recipes.saving : t.recipes.saveCopy}
    </Button>
  )
}
