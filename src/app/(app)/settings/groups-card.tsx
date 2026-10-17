'use client'

import { Link2, UserMinus } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createGroup, createInvite, leaveGroup, removeMember, revokeInvite } from '@/actions/groups'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { CopyBlock, RevokeButton } from './connect-claude-card'

type Member = { userId: string; name: string; email: string; role: 'admin' | 'member' }
type Invite = { id: string; expiresAt: Date; createdBy: string }
type GroupRow = {
  id: string
  name: string
  role: 'admin' | 'member'
  memberCount: number
  members: Member[]
  invites: Invite[]
}

const inviteDate = new Intl.DateTimeFormat('en', { dateStyle: 'medium' })

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

function GroupItem({ group, userId }: { group: GroupRow; userId: string }) {
  const [inviteUrl, setInviteUrl] = useState<string>()
  const [pending, startTransition] = useTransition()
  const isAdmin = group.role === 'admin'

  function run(action: () => Promise<{ error?: string }>, onSuccess?: () => void) {
    startTransition(async () => {
      const result = await action()
      if (result.error !== undefined) toast.error(result.error)
      else onSuccess?.()
    })
  }

  function invite() {
    startTransition(async () => {
      const result = await createInvite(group.id)
      if (result.error !== undefined) toast.error(result.error)
      else setInviteUrl(result.url)
    })
  }

  return (
    <li className="space-y-4 py-5 first:pt-0">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg">{group.name}</h3>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? 'Admin' : 'Member'}, {plural(group.memberCount, 'member')}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() =>
            run(
              () => leaveGroup(group.id),
              () => toast.success(`Left ${group.name}`)
            )
          }
        >
          Leave
        </Button>
      </div>

      <ul className="divide-y">
        {group.members.map((m) => (
          <li key={m.userId} className="flex items-center gap-2 py-2">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {m.name}
                {m.role === 'admin' && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">Admin</span>
                )}
              </p>
              <p className="truncate text-sm text-muted-foreground">{m.email}</p>
            </div>
            {isAdmin && m.userId !== userId && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${m.name}`}
                disabled={pending}
                onClick={() => run(() => removeMember(group.id, m.userId))}
              >
                <UserMinus />
              </Button>
            )}
          </li>
        ))}
      </ul>

      {isAdmin && (
        <div className="space-y-3">
          {group.invites.length > 0 && (
            <ul className="divide-y">
              {group.invites.map((i) => (
                <li key={i.id} className="flex items-center gap-2 py-2">
                  <Link2 className="size-4 text-muted-foreground" />
                  <p className="min-w-0 flex-1 text-sm">
                    Invite link by {i.createdBy}, expires {inviteDate.format(i.expiresAt)}
                  </p>
                  <RevokeButton name="invite link" revoke={() => revokeInvite(i.id)} />
                </li>
              ))}
            </ul>
          )}
          <Button variant="outline" size="sm" disabled={pending} onClick={invite}>
            <Link2 />
            Create invite link
          </Button>
          {inviteUrl && (
            <div className="space-y-3 rounded-lg border p-4">
              <p className="text-sm">
                Anyone with this link can join for 7 days. Copy it now, it won’t be shown again.
              </p>
              <CopyBlock label="Invite link" text={inviteUrl} />
            </div>
          )}
        </div>
      )}
    </li>
  )
}

export function GroupsCard({ groups, userId }: { groups: GroupRow[]; userId: string }) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()

  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const result = await createGroup({ name })
      if (result.error !== undefined) {
        setError(result.error)
        return
      }
      setError(undefined)
      setName('')
    })
  }

  return (
    <section className="max-w-2xl space-y-5">
      <div className="space-y-1">
        <h2 className="text-2xl">Groups</h2>
        <p className="text-sm text-muted-foreground">
          Each group has its own shopping list and pantry. Recipes you share into a group are
          visible to its members.
        </p>
      </div>
      <ul className="divide-y">
        {groups.map((g) => (
          <GroupItem key={g.id} group={g} userId={userId} />
        ))}
      </ul>
      <form onSubmit={submit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="group-name">New group</FieldLabel>
            <div className="flex gap-2">
              <Input
                id="group-name"
                placeholder="Weekend cabin"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Button type="submit" disabled={pending || !name.trim()}>
                {pending ? 'Creating…' : 'Create group'}
              </Button>
            </div>
            {error && <FieldError>{error}</FieldError>}
          </Field>
        </FieldGroup>
      </form>
    </section>
  )
}
