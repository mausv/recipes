'use client'

import { Link2 } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createInvite, revokeInvite } from '@/actions/groups'
import { Button } from '@/components/ui/button'
import { CopyBlock, RevokeButton } from '../../settings/connect-claude-card'

type Invite = { id: string; createdBy: string; created: string; expires: string }

export function InviteLinks({ groupId, invites }: { groupId: string; invites: Invite[] }) {
  const [url, setUrl] = useState<string>()
  const [pending, startTransition] = useTransition()

  function create() {
    startTransition(async () => {
      const result = await createInvite(groupId)
      if (result.error !== undefined) toast.error(result.error)
      else setUrl(result.url)
    })
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-2xl">Invite links</h2>
        <p className="text-sm text-muted-foreground">
          Anyone with a link can join for 7 days, until you revoke it.
        </p>
      </div>
      {invites.length > 0 && (
        <ul className="divide-y border-y">
          {invites.map((i) => (
            <li key={i.id} className="flex items-center gap-2 py-2">
              <Link2 className="size-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  Created {i.created} by {i.createdBy}
                </p>
                <p className="text-[13px] text-muted-foreground">Expires {i.expires}</p>
              </div>
              <RevokeButton name="invite link" revoke={() => revokeInvite(i.id)} />
            </li>
          ))}
        </ul>
      )}
      <Button variant="outline" disabled={pending} onClick={create}>
        <Link2 />
        {pending ? 'Creating…' : 'Create invite link'}
      </Button>
      {url && (
        <div className="space-y-3 rounded-lg border p-4">
          <p className="text-sm">Copy this link now, it won’t be shown again.</p>
          <CopyBlock label="Invite link" text={url} />
        </div>
      )}
    </section>
  )
}
