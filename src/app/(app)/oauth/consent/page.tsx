import { headers } from 'next/headers'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { auth } from '@/lib/auth'
import { toQueryString } from '@/lib/oauth-query'
import { ConsentButtons } from './consent-buttons'

export const instant = false

export default async function ConsentPage({ searchParams }: PageProps<'/oauth/consent'>) {
  const params = await searchParams
  const client = await auth.api.getOAuthClientPublic({
    query: { client_id: String(params.client_id) },
    headers: await headers(),
  })
  const name = client.client_name ?? 'An app'

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>Connect {name}</CardTitle>
        <CardDescription>{name} wants access to your Recipes account.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Read and change your recipes, ingredients, shopping list and pantry</li>
          <li>Stay connected until you revoke access in Settings</li>
        </ul>
        <ConsentButtons oauthQuery={toQueryString(params)} />
      </CardContent>
    </Card>
  )
}
