'use client'

import { useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { useT, useTError } from '@/i18n/client'

export function ConsentButtons({ oauthQuery }: { oauthQuery: string }) {
  const t = useT()
  const tError = useTError()
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
      return setError(error.message ? tError(error.message) : t.auth.requestFailed)
    }
    window.location.assign(data.url)
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled={pending} onClick={() => respond(false)}>
          {t.auth.deny}
        </Button>
        <Button disabled={pending} onClick={() => respond(true)}>
          {t.auth.approve}
        </Button>
      </div>
      {error && <p className="text-right text-sm text-destructive">{error}</p>}
    </div>
  )
}
