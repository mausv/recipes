'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useT, useTError } from '@/i18n/client'
import { authClient } from '@/lib/auth-client'

export function ChangePasswordCard() {
  const t = useT()
  const tError = useTError()
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const newPassword = String(form.get('newPassword'))
    if (newPassword !== form.get('confirmPassword')) return setError(t.auth.passwordsDontMatch)
    setPending(true)
    const { error } = await authClient.changePassword({
      currentPassword: String(form.get('currentPassword')),
      newPassword,
      revokeOtherSessions: true,
    })
    setPending(false)
    if (error) return setError(error.message ? tError(error.message) : t.auth.requestFailed)
    setError(undefined)
    formElement.reset()
    toast.success(t.settings.passwordChanged)
  }

  return (
    <section className="max-w-2xl space-y-5">
      <div className="space-y-1">
        <h2 className="text-2xl">{t.settings.changePassword}</h2>
        <p className="text-sm text-muted-foreground">{t.settings.changePasswordDescription}</p>
      </div>
      <form onSubmit={onSubmit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="current-password">{t.auth.currentPassword}</FieldLabel>
            <Input
              id="current-password"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="new-password">{t.auth.newPassword}</FieldLabel>
            <Input
              id="new-password"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="confirm-password">{t.auth.confirmPassword}</FieldLabel>
            <Input
              id="confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </Field>
          <FieldError>{error}</FieldError>
          <Button type="submit" disabled={pending} className="w-fit">
            {pending ? t.settings.changingPassword : t.settings.changePassword}
          </Button>
        </FieldGroup>
      </form>
    </section>
  )
}
