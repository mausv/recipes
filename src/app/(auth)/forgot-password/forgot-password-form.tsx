'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useT, useTError } from '@/i18n/client'
import { authClient } from '@/lib/auth-client'

export function ForgotPasswordForm() {
  const t = useT()
  const tError = useTError()
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)

  async function onSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    const { error } = await authClient.requestPasswordReset({
      email: String(form.get('email')),
      redirectTo: '/reset-password',
    })
    setPending(false)
    if (error) return setError(error.message ? tError(error.message) : t.auth.requestFailed)
    setSent(true)
  }

  const backToSignIn = (
    <p className="text-sm text-muted-foreground">
      <Link href="/login" className="text-primary underline underline-offset-4">
        {t.auth.backToSignIn}
      </Link>
    </p>
  )

  if (sent)
    return (
      <div className="space-y-6">
        <div className="space-y-1" role="status">
          <h1 className="text-2xl">{t.auth.resetLinkCreated}</h1>
          <p className="text-muted-foreground">{t.auth.resetLinkCreatedDescription}</p>
        </div>
        {backToSignIn}
      </div>
    )

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl">{t.auth.resetPassword}</h1>
        <p className="text-muted-foreground">{t.auth.forgotDescription}</p>
      </div>
      <form onSubmit={onSubmit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="email">{t.auth.email}</FieldLabel>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </Field>
          <FieldError>{error}</FieldError>
          <Button type="submit" disabled={pending}>
            {pending ? t.auth.creatingResetLink : t.auth.createResetLink}
          </Button>
          {backToSignIn}
        </FieldGroup>
      </form>
    </div>
  )
}
