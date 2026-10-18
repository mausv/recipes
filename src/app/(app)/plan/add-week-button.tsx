'use client'

import { ShoppingCart } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { addWeekToShoppingList } from '@/actions/shopping'
import { Button } from '@/components/ui/button'
import { useT, useTError } from '@/i18n/client'

export function AddWeekButton({ monday }: { monday: string }) {
  const router = useRouter()
  const t = useT()
  const tError = useTError()
  const [pending, startTransition] = useTransition()

  function add() {
    startTransition(async () => {
      const result = await addWeekToShoppingList(monday)
      if ('error' in result) {
        toast.error(tError(result.error))
        return
      }
      const { added, skipped } = result
      const description = skipped ? t.plan.recipesSkipped(skipped) : undefined
      if (added) {
        toast.success(t.plan.recipesAdded(added), {
          description,
          action: { label: t.plan.viewList, onClick: () => router.push('/shopping') },
        })
      } else {
        toast(t.plan.noRecipesToAdd, { description })
      }
    })
  }

  return (
    <Button variant="outline" onClick={add} disabled={pending}>
      <ShoppingCart />
      {pending ? t.plan.adding : t.plan.addWeek}
    </Button>
  )
}
