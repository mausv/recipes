'use client'

import { Link2 } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createInvite, revokeInvite } from '@/actions/groups'
import { Button } from '@/components/ui/button'
import { useT, useTError } from '@/i18n/client'
import { CopyBlock, RevokeButton } from '../../settings/connect-claude-card'

type Invite = { id: string; createdBy: string; created: string; expires: string }

export function InviteLinks({ groupId, invites }: { groupId: string; invites: Invite[] }) {
  const t = useT()
  const tError = useTError()
  const [url, setUrl] = useState<string>()
  const [pending, startTransition] = useTransition()

  function create() {
    startTransition(async () => {
      const result = await createInvite(groupId)
      if (result.error !== undefined) toast.error(tError(result.error))
      else setUrl(result.url)
    })
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-2xl">{t.groups.inviteLinks}</h2>
        <p className="text-sm text-muted-foreground">{t.groups.inviteLinksDescription}</p>
      </div>
      {invites.length > 0 && (
        <ul className="divide-y border-y">
          {invites.map((i) => (
            <li key={i.id} className="flex items-center gap-2 py-2">
              <Link2 className="size-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm">{t.groups.inviteCreated(i.created, i.createdBy)}</p>
                <p className="text-[13px] text-muted-foreground">
                  {t.groups.inviteExpires(i.expires)}
                </p>
              </div>
              <RevokeButton name={t.groups.inviteLinkName} revoke={() => revokeInvite(i.id)} />
            </li>
          ))}
        </ul>
      )}
      <Button variant="outline" disabled={pending} onClick={create}>
        <Link2 />
        {pending ? t.common.creating : t.groups.createInviteLink}
      </Button>
      {url && (
        <div className="space-y-3 rounded-lg border p-4">
          <p className="text-sm">{t.groups.copyLinkNow}</p>
          <CopyBlock label={t.groups.inviteLink} text={url} />
        </div>
      )}
    </section>
  )
}
