'use client'

import { ShoppingCart } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { addWeekToShoppingList } from '@/actions/shopping'
import { Button } from '@/components/ui/button'

function recipes(n: number) {
  return `${n} ${n === 1 ? 'recipe' : 'recipes'}`
}

export function AddWeekButton({ monday }: { monday: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function add() {
    startTransition(async () => {
      const result = await addWeekToShoppingList(monday)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      const { added, skipped } = result
      const description = skipped
        ? `Skipped ${recipes(skipped)} no longer shared with you.`
        : undefined
      if (added) {
        toast.success(`${recipes(added)} added`, {
          description,
          action: { label: 'View list', onClick: () => router.push('/shopping') },
        })
      } else {
        toast('No recipes to add', { description })
      }
    })
  }

  return (
    <Button variant="outline" onClick={add} disabled={pending}>
      <ShoppingCart />
      {pending ? 'Adding…' : 'Add week to shopping list'}
    </Button>
  )
}
