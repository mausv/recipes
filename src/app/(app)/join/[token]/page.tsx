import Link from 'next/link'
import { getInviteGroup, isMember } from '@/lib/groups'
import { getT } from '@/lib/i18n-server'
import { requireUser } from '@/lib/session'
import { JoinButton, OpenGroupButton } from './join-button'

export default async function JoinPage({ params }: PageProps<'/join/[token]'>) {
  const { token } = await params
  const user = await requireUser()
  const t = await getT()
  const group = getInviteGroup(token)

  if (!group) {
    return (
      <div className="max-w-md space-y-2 py-12">
        <h1 className="text-[32px] leading-tight">{t.groups.inviteInvalid}</h1>
        <p className="text-muted-foreground">{t.groups.inviteInvalidDescription}</p>
        <p>
          <Link href="/" className="text-primary underline underline-offset-4">
            {t.groups.goToRecipes}
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-md space-y-6 py-12">
      <div className="space-y-2">
        <h1 className="text-[32px] leading-tight">{t.groups.joinName(group.name)}</h1>
        <p>{t.groups.invitedYou(group.invitedBy, group.memberCount)}</p>
        <p className="text-muted-foreground">{t.groups.joinDescription}</p>
      </div>
      {isMember(user.id, group.id) ? (
        <div className="space-y-3">
          <p>{t.groups.alreadyMember}</p>
          <OpenGroupButton groupId={group.id} />
        </div>
      ) : (
        <JoinButton token={token} />
      )}
    </div>
  )
}
