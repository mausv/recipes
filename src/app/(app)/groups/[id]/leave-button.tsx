'use client'

import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { leaveGroup } from '@/actions/groups'
import { Button } from '@/components/ui/button'
import { useT, useTError } from '@/i18n/client'

export function LeaveButton({ groupId, name }: { groupId: string; name: string }) {
  const router = useRouter()
  const t = useT()
  const tError = useTError()
  const [pending, startTransition] = useTransition()

  function leave() {
    startTransition(async () => {
      const result = await leaveGroup(groupId)
      if (result.error !== undefined) {
        toast.error(tError(result.error))
        return
      }
      toast.success(t.groups.left(name))
      router.push('/groups')
    })
  }

  return (
    <Button
      variant="ghost"
      disabled={pending}
      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
      onClick={leave}
    >
      <LogOut />
      {pending ? t.groups.leaving : t.groups.leave}
    </Button>
  )
}
