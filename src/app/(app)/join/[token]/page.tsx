import Link from 'next/link'
import { getInviteGroup, isMember } from '@/lib/groups'
import { requireUser } from '@/lib/session'
import { JoinButton } from './join-button'

export default async function JoinPage({ params }: PageProps<'/join/[token]'>) {
  const { token } = await params
  const user = await requireUser()
  const group = getInviteGroup(token)

  if (!group) {
    return (
      <div className="max-w-md space-y-2 py-12">
        <h1 className="text-[32px] leading-tight">Invite not found</h1>
        <p className="text-muted-foreground">
          This invite link is invalid or has expired. Ask for a new one.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-md space-y-6 py-12">
      <div className="space-y-2">
        <h1 className="text-[32px] leading-tight">Join {group.name}</h1>
        <p className="text-muted-foreground">
          Members share a shopping list and pantry, and can cook from the recipes shared into the
          group.
        </p>
      </div>
      {isMember(user.id, group.id) ? (
        <p>
          You’re already in this group.{' '}
          <Link href="/" className="text-primary underline underline-offset-4">
            Go to recipes
          </Link>
        </p>
      ) : (
        <JoinButton token={token} />
      )}
    </div>
  )
}
