'use client'

import { Copy, KeyRound, Plug, Trash2 } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createApiKey, revokeApiKey } from '@/actions/api-keys'
import { revokeOAuthClient } from '@/actions/oauth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

type ApiKeyRow = { id: string; name: string; createdAt: Date; lastUsedAt: Date | null }
type ConnectionRow = { clientId: string; name: string | null; connectedAt: Date }

const keyDate = new Intl.DateTimeFormat('en', { dateStyle: 'medium' })

function CopyBlock({ label, text }: { label: string; text: string }) {
  async function copy() {
    await navigator.clipboard.writeText(text)
    toast.success(`${label} copied`)
  }

  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex items-start gap-2 rounded-md bg-muted p-3">
        <code className="min-w-0 flex-1 font-mono text-xs break-all">{text}</code>
        <Button variant="ghost" size="icon-sm" aria-label={`Copy ${label}`} onClick={copy}>
          <Copy />
        </Button>
      </div>
    </div>
  )
}

function RevokeButton({
  name,
  revoke: revokeAction,
}: {
  name: string
  revoke: () => Promise<{ error?: string }>
}) {
  const [pending, startTransition] = useTransition()

  function revoke() {
    startTransition(async () => {
      const result = await revokeAction()
      if (result.error !== undefined) toast.error(result.error)
    })
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={`Revoke ${name}`}
      disabled={pending}
      onClick={revoke}
    >
      <Trash2 />
    </Button>
  )
}

export function ConnectClaudeCard({
  keys,
  connections,
  endpoint,
}: {
  keys: ApiKeyRow[]
  connections: ConnectionRow[]
  endpoint: string
}) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string>()
  const [created, setCreated] = useState<{ name: string; key: string }>()
  const [pending, startTransition] = useTransition()

  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const result = await createApiKey({ name })
      if (result.error !== undefined) {
        setError(result.error)
        return
      }
      setError(undefined)
      setCreated({ name: name.trim(), key: result.key })
      setName('')
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect Claude</CardTitle>
        <CardDescription>
          Let Claude read and change your recipes, ingredients, shopping list and pantry over MCP.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-2">
          <h3 className="font-medium">Claude.ai and Claude Desktop</h3>
          <p className="text-sm text-muted-foreground">
            Settings → Connectors → Add custom connector, paste this URL, then sign in and approve.
          </p>
          <CopyBlock label="Connector URL" text={endpoint} />
        </section>

        <section className="space-y-2">
          <h3 className="font-medium">Claude Code</h3>
          <CopyBlock label="Command" text={`claude mcp add --transport http recipes ${endpoint}`} />
          <p className="text-sm text-muted-foreground">
            Then run <code className="font-mono">/mcp</code> in Claude Code to sign in and approve.
          </p>
        </section>

        {connections.length > 0 && (
          <section className="space-y-2">
            <h3 className="font-medium">Connected apps</h3>
            <ul className="divide-y">
              {connections.map((c) => (
                <li key={c.clientId} className="flex items-center gap-2 py-2">
                  <Plug className="size-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{c.name ?? 'Unnamed app'}</p>
                    <p className="text-sm text-muted-foreground">
                      Connected {keyDate.format(c.connectedAt)}
                    </p>
                  </div>
                  <RevokeButton
                    name={c.name ?? 'Unnamed app'}
                    revoke={() => revokeOAuthClient(c.clientId)}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="space-y-4">
          <div className="space-y-1">
            <h3 className="font-medium">For scripts</h3>
            <p className="text-sm text-muted-foreground">
              API keys work with any MCP client that can send a bearer header.
            </p>
          </div>
          {keys.length > 0 && (
            <ul className="divide-y">
              {keys.map((k) => (
                <li key={k.id} className="flex items-center gap-2 py-2">
                  <KeyRound className="size-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{k.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Created {keyDate.format(k.createdAt)}
                      {k.lastUsedAt && ` · last used ${keyDate.format(k.lastUsedAt)}`}
                    </p>
                  </div>
                  <RevokeButton name={k.name} revoke={() => revokeApiKey(k.id)} />
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={submit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="api-key-name">Key name</FieldLabel>
                <div className="flex gap-2">
                  <Input
                    id="api-key-name"
                    placeholder="Nightly meal-plan script"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <Button type="submit" disabled={pending || !name.trim()}>
                    {pending ? 'Creating…' : 'Create key'}
                  </Button>
                </div>
                {error && <FieldError>{error}</FieldError>}
              </Field>
            </FieldGroup>
          </form>

          {created && (
            <div className="space-y-4 rounded-lg border p-4">
              <p className="text-sm">
                Key <span className="font-medium">{created.name}</span> created. Copy it now, it
                won’t be shown again.
              </p>
              <CopyBlock label="API key" text={created.key} />
              <CopyBlock label="Header" text={`Authorization: Bearer ${created.key}`} />
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  )
}
