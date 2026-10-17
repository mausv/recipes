import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { deleteGroup } from '@/actions/groups'
import { ConfirmDeleteButton } from '@/components/confirm-delete-button'
import { listGroups, listInvites, listMembers } from '@/lib/groups'
import { requireUser } from '@/lib/session'
import { InviteLinks } from './invite-links'
import { LeaveButton } from './leave-button'
import { MemberActions } from './member-actions'
import { RenameGroup } from './rename-group'

const date = new Intl.DateTimeFormat('en', { dateStyle: 'medium' })

export default async function GroupPage({ params }: PageProps<'/groups/[id]'>) {
  const { id } = await params
  const user = await requireUser()
  const group = listGroups(user.id).find((g) => g.id === id)
  if (!group) notFound()
  const isAdmin = group.role === 'admin'
  const members = listMembers(id)

  return (
    <div className="max-w-2xl space-y-10 md:space-y-14">
      <div className="space-y-2">
        <Link
          href="/groups"
          className="-ml-1 inline-flex h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground sm:h-8"
        >
          <ChevronLeft className="size-4" />
          Groups
        </Link>
        {isAdmin ? (
          <RenameGroup groupId={id} name={group.name} />
        ) : (
          <h1 className="text-[32px] leading-tight tracking-[-0.01em]">{group.name}</h1>
        )}
        <p className="text-muted-foreground">
          You’re {isAdmin ? 'an admin' : 'a member'}. {members.length}{' '}
          {members.length === 1 ? 'member' : 'members'}.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-2xl">Members</h2>
        <ul className="divide-y border-y">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center gap-2 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {m.name}
                  {m.userId === user.id && (
                    <span className="font-normal text-muted-foreground"> (you)</span>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  {m.role === 'admin' ? 'Admin' : 'Member'}, joined {date.format(m.joinedAt)}
                </p>
              </div>
              {isAdmin && m.userId !== user.id && (
                <MemberActions
                  groupId={id}
                  userId={m.userId}
                  name={m.name}
                  isAdmin={m.role === 'admin'}
                />
              )}
            </li>
          ))}
        </ul>
      </section>

      {isAdmin && (
        <InviteLinks
          groupId={id}
          invites={listInvites(id).map((i) => ({
            id: i.id,
            createdBy: i.createdBy,
            created: date.format(i.createdAt),
            expires: date.format(i.expiresAt),
          }))}
        />
      )}

      <section className="space-y-4">
        <h2 className="text-2xl">Leave group</h2>
        <p className="text-sm text-muted-foreground">
          {members.length === 1
            ? 'You’re the only member, so leaving deletes the group.'
            : 'A group always needs an admin. If you’re the only one, make someone else an admin first.'}
        </p>
        <LeaveButton groupId={id} name={group.name} />
      </section>

      {isAdmin && (
        <section className="space-y-4">
          <h2 className="text-2xl">Delete group</h2>
          <p className="text-sm text-muted-foreground">
            Removes the group for everyone, with its shopping list, pantry and meal plan. Shared
            recipes stay with their owners.
          </p>
          <ConfirmDeleteButton
            title={`Delete ${group.name}?`}
            description="Everyone loses access to its shopping list, pantry, meal plan and shared recipes. This can’t be undone."
            onConfirmAction={deleteGroup.bind(null, id)}
            redirectTo="/groups"
          />
        </section>
      )}
    </div>
  )
}
