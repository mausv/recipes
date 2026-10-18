'use client'

import { Copy, KeyRound, Plug, Trash2 } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createApiKey, revokeApiKey } from '@/actions/api-keys'
import { revokeOAuthClient } from '@/actions/oauth'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useLocale, useT, useTError } from '@/i18n/client'
import { dateFormatter } from '@/i18n/format'

type ApiKeyRow = { id: string; name: string; createdAt: Date; lastUsedAt: Date | null }
type ConnectionRow = { clientId: string; name: string | null; connectedAt: Date }

export function CopyBlock({ label, text }: { label: string; text: string }) {
  const t = useT()

  async function copy() {
    await navigator.clipboard.writeText(text)
    toast.success(t.common.copied(label))
  }

  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex items-start gap-2 rounded-md bg-muted p-3">
        <code className="min-w-0 flex-1 font-mono text-xs break-all">{text}</code>
        <Button variant="ghost" size="icon-sm" aria-label={t.common.copy(label)} onClick={copy}>
          <Copy />
        </Button>
      </div>
    </div>
  )
}

export function RevokeButton({
  name,
  revoke: revokeAction,
}: {
  name: string
  revoke: () => Promise<{ error?: string }>
}) {
  const t = useT()
  const tError = useTError()
  const [pending, startTransition] = useTransition()

  function revoke() {
    startTransition(async () => {
      const result = await revokeAction()
      if (result.error !== undefined) toast.error(tError(result.error))
    })
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={t.common.revoke(name)}
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
  const t = useT()
  const tError = useTError()
  const keyDate = dateFormatter(useLocale(), { dateStyle: 'medium' })
  const [name, setName] = useState('')
  const [error, setError] = useState<string>()
  const [created, setCreated] = useState<{ name: string; key: string }>()
  const [pending, startTransition] = useTransition()

  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const result = await createApiKey({ name })
      if (result.error !== undefined) {
        setError(tError(result.error))
        return
      }
      setError(undefined)
      setCreated({ name: name.trim(), key: result.key })
      setName('')
    })
  }

  return (
    <section className="max-w-2xl space-y-5">
      <div className="space-y-1">
        <h2 className="text-2xl">{t.settings.connectClaude}</h2>
        <p className="text-sm text-muted-foreground">{t.settings.connectDescription}</p>
      </div>
      <div className="space-y-6">
        <section className="space-y-2">
          <h3 className="text-lg">{t.settings.claudeApps}</h3>
          <p className="text-sm text-muted-foreground">{t.settings.connectorSteps}</p>
          <CopyBlock label={t.settings.connectorUrl} text={endpoint} />
        </section>

        <section className="space-y-2">
          <h3 className="text-lg">Claude Code</h3>
          <CopyBlock
            label={t.settings.command}
            text={`claude mcp add --transport http recipes ${endpoint}`}
          />
          <p className="text-sm text-muted-foreground">
            {t.settings.claudeCodeThen} <code className="font-mono">/mcp</code>{' '}
            {t.settings.claudeCodeSignIn}
          </p>
        </section>

        {connections.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-lg">{t.settings.connectedApps}</h3>
            <ul className="divide-y">
              {connections.map((c) => (
                <li key={c.clientId} className="flex items-center gap-2 py-2">
                  <Plug className="size-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{c.name ?? t.settings.unnamedApp}</p>
                    <p className="text-sm text-muted-foreground">
                      {t.settings.connected(keyDate.format(c.connectedAt))}
                    </p>
                  </div>
                  <RevokeButton
                    name={c.name ?? t.settings.unnamedApp}
                    revoke={() => revokeOAuthClient(c.clientId)}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-lg">{t.settings.forScripts}</h3>
            <p className="text-sm text-muted-foreground">{t.settings.apiKeysDescription}</p>
          </div>
          {keys.length > 0 && (
            <ul className="divide-y">
              {keys.map((k) => (
                <li key={k.id} className="flex items-center gap-2 py-2">
                  <KeyRound className="size-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{k.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {t.settings.keyCreated(keyDate.format(k.createdAt))}
                      {k.lastUsedAt && t.settings.keyLastUsed(keyDate.format(k.lastUsedAt))}
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
                <FieldLabel htmlFor="api-key-name">{t.settings.keyName}</FieldLabel>
                <div className="flex gap-2">
                  <Input
                    id="api-key-name"
                    placeholder={t.settings.keyNamePlaceholder}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <Button type="submit" disabled={pending || !name.trim()}>
                    {pending ? t.common.creating : t.settings.createKey}
                  </Button>
                </div>
                {error && <FieldError>{error}</FieldError>}
              </Field>
            </FieldGroup>
          </form>

          {created && (
            <div className="space-y-4 rounded-lg border p-4">
              <p className="text-sm">
                {t.settings.newKeyBefore} <span className="font-medium">{created.name}</span>{' '}
                {t.settings.newKeyAfter}
              </p>
              <CopyBlock label={t.settings.apiKey} text={created.key} />
              <CopyBlock label={t.settings.header} text={`Authorization: Bearer ${created.key}`} />
            </div>
          )}
        </section>
      </div>
    </section>
  )
}
