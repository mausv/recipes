'use client'

import { UserMinus } from 'lucide-react'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { promoteMember, removeMember } from '@/actions/groups'
import { Button } from '@/components/ui/button'

export function MemberActions({
  groupId,
  userId,
  name,
  isAdmin,
}: {
  groupId: string
  userId: string
  name: string
  isAdmin: boolean
}) {
  const [pending, startTransition] = useTransition()

  function run(action: () => Promise<{ error?: string }>) {
    startTransition(async () => {
      const result = await action()
      if (result.error !== undefined) toast.error(result.error)
    })
  }

  return (
    <div className="flex items-center gap-1">
      {!isAdmin && (
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Make ${name} an admin`}
          disabled={pending}
          onClick={() => run(() => promoteMember(groupId, userId))}
        >
          Make admin
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Remove ${name}`}
        disabled={pending}
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => run(() => removeMember(groupId, userId))}
      >
        <UserMinus />
      </Button>
    </div>
  )
}
