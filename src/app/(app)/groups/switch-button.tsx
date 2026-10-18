'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { setActiveGroup } from '@/actions/groups'
import { Button } from '@/components/ui/button'
import { useT, useTError } from '@/i18n/client'

export function SwitchButton({ groupId, name }: { groupId: string; name: string }) {
  const router = useRouter()
  const t = useT()
  const tError = useTError()
  const [pending, startTransition] = useTransition()

  function switchTo() {
    startTransition(async () => {
      const result = await setActiveGroup(groupId)
      if (result.error !== undefined) toast.error(tError(result.error))
      else router.refresh()
    })
  }

  return (
    <Button
      variant="outline"
      size="sm"
      aria-label={t.groups.switchTo(name)}
      disabled={pending}
      onClick={switchTo}
    >
      {t.groups.switch}
    </Button>
  )
}
