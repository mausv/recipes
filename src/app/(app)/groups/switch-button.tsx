'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { setActiveGroup } from '@/actions/groups'
import { Button } from '@/components/ui/button'

export function SwitchButton({ groupId, name }: { groupId: string; name: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function switchTo() {
    startTransition(async () => {
      const result = await setActiveGroup(groupId)
      if (result.error !== undefined) toast.error(result.error)
      else router.refresh()
    })
  }

  return (
    <Button
      variant="outline"
      size="sm"
      aria-label={`Switch to ${name}`}
      disabled={pending}
      onClick={switchTo}
    >
      Switch to
    </Button>
  )
}
