'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useT, useTError } from '@/i18n/client'
import { authClient } from '@/lib/auth-client'
import { useLocationSearch } from '@/lib/use-location-search'

export function ResetPasswordForm() {
  const router = useRouter()
  const t = useT()
  const tError = useTError()
  const params = new URLSearchParams(useLocationSearch())
  const [error, setError] = useState<string>()
  const [expired, setExpired] = useState(false)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const newPassword = String(form.get('newPassword'))
    if (newPassword !== form.get('confirmPassword')) return setError(t.auth.passwordsDontMatch)
    setPending(true)
    const { error } = await authClient.resetPassword({
      newPassword,
      token: params.get('token') ?? '',
    })
    setPending(false)
    if (error?.code === 'INVALID_TOKEN') return setExpired(true)
    if (error) return setError(error.message ? tError(error.message) : t.auth.requestFailed)
    toast.success(t.auth.passwordResetDone)
    router.push('/login')
  }

  if (expired || params.has('error'))
    return (
      <div className="space-y-6">
        <div className="space-y-1" role="alert">
          <h1 className="text-2xl">{t.auth.resetPassword}</h1>
          <p className="text-muted-foreground">{t.auth.invalidResetLink}</p>
        </div>
        <p className="text-sm">
          <Link href="/forgot-password" className="text-primary underline underline-offset-4">
            {t.auth.requestNewLink}
          </Link>
        </p>
      </div>
    )

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl">{t.auth.resetPassword}</h1>
        <p className="text-muted-foreground">{t.auth.choosePassword}</p>
      </div>
      <form onSubmit={onSubmit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="newPassword">{t.auth.newPassword}</FieldLabel>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="confirmPassword">{t.auth.confirmPassword}</FieldLabel>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </Field>
          <FieldError>{error}</FieldError>
          <Button type="submit" disabled={pending}>
            {pending ? t.auth.resettingPassword : t.auth.resetPassword}
          </Button>
        </FieldGroup>
      </form>
    </div>
  )
}
