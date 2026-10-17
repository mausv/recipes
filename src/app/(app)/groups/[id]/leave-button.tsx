'use client'

import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { leaveGroup } from '@/actions/groups'
import { Button } from '@/components/ui/button'

export function LeaveButton({ groupId, name }: { groupId: string; name: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function leave() {
    startTransition(async () => {
      const result = await leaveGroup(groupId)
      if (result.error !== undefined) {
        toast.error(result.error)
        return
      }
      toast.success(`Left ${name}`)
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
      {pending ? 'Leaving…' : 'Leave group'}
    </Button>
  )
}
