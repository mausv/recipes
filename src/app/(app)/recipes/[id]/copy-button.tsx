'use client'

import { Copy } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { copyRecipe } from '@/actions/recipes'
import { Button } from '@/components/ui/button'

export function CopyButton({ recipeId }: { recipeId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function copy() {
    startTransition(async () => {
      const result = await copyRecipe(recipeId)
      if (result.error !== undefined) {
        toast.error(result.error)
        return
      }
      toast.success('Saved to your recipes')
      router.push(`/recipes/${result.id}`)
    })
  }

  return (
    <Button variant="ghost" onClick={copy} disabled={pending}>
      <Copy />
      {pending ? 'Saving…' : 'Save a copy'}
    </Button>
  )
}
