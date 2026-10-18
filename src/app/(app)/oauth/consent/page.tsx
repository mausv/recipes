import { headers } from 'next/headers'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { auth } from '@/lib/auth'
import { getT } from '@/lib/i18n-server'
import { toQueryString } from '@/lib/oauth-query'
import { ConsentButtons } from './consent-buttons'

export const instant = false

export default async function ConsentPage({ searchParams }: PageProps<'/oauth/consent'>) {
  const params = await searchParams
  const client = await auth.api.getOAuthClientPublic({
    query: { client_id: String(params.client_id) },
    headers: await headers(),
  })
  const t = await getT()
  const name = client.client_name ?? t.auth.anApp

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>{t.auth.consentTitle(name)}</CardTitle>
        <CardDescription>{t.auth.consentDescription(name)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>{t.auth.consentRead}</li>
          <li>{t.auth.consentStay}</li>
        </ul>
        <ConsentButtons oauthQuery={toQueryString(params)} />
      </CardContent>
    </Card>
  )
}
