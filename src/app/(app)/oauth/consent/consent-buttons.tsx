'use client'

import { useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'

export function ConsentButtons({ oauthQuery }: { oauthQuery: string }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()

  async function respond(accept: boolean) {
    setPending(true)
    const { data, error } = await authClient.$fetch<{ url: string }>('/oauth2/consent', {
      method: 'POST',
      body: { accept, oauth_query: oauthQuery },
    })
    if (error) {
      setPending(false)
      return setError(error.message ?? 'Could not complete the request')
    }
    window.location.assign(data.url)
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled={pending} onClick={() => respond(false)}>
          Deny
        </Button>
        <Button disabled={pending} onClick={() => respond(true)}>
          Approve
        </Button>
      </div>
      {error && <p className="text-right text-sm text-destructive">{error}</p>}
    </div>
  )
}
