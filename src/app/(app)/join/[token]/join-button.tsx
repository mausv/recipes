'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { acceptInvite } from '@/actions/groups'
import { Button } from '@/components/ui/button'

export function JoinButton({ token }: { token: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function join() {
    startTransition(async () => {
      const result = await acceptInvite(token)
      if (result.error !== undefined) {
        toast.error(result.error)
        return
      }
      router.push('/')
      router.refresh()
    })
  }

  return (
    <Button onClick={join} disabled={pending}>
      {pending ? 'Joining…' : 'Join'}
    </Button>
  )
}
