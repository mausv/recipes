import Link from 'next/link'
import { getInviteGroup, isMember } from '@/lib/groups'
import { requireUser } from '@/lib/session'
import { JoinButton, OpenGroupButton } from './join-button'

export default async function JoinPage({ params }: PageProps<'/join/[token]'>) {
  const { token } = await params
  const user = await requireUser()
  const group = getInviteGroup(token)

  if (!group) {
    return (
      <div className="max-w-md space-y-2 py-12">
        <h1 className="text-[32px] leading-tight">This invite link no longer works</h1>
        <p className="text-muted-foreground">
          It has expired or was revoked. Ask someone in the group for a new one.
        </p>
        <p>
          <Link href="/" className="text-primary underline underline-offset-4">
            Go to your recipes
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-md space-y-6 py-12">
      <div className="space-y-2">
        <h1 className="text-[32px] leading-tight">Join {group.name}</h1>
        <p>
          {group.invitedBy} invited you. The group has {group.memberCount}{' '}
          {group.memberCount === 1 ? 'member' : 'members'}.
        </p>
        <p className="text-muted-foreground">
          Members share a shopping list, pantry and meal plan, and can cook from the recipes shared
          into the group.
        </p>
      </div>
      {isMember(user.id, group.id) ? (
        <div className="space-y-3">
          <p>You’re already in this group.</p>
          <OpenGroupButton groupId={group.id} />
        </div>
      ) : (
        <JoinButton token={token} />
      )}
    </div>
  )
}
