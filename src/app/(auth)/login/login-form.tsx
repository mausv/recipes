'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { authClient } from '@/lib/auth-client'
import { signedOAuthQuery } from '@/lib/oauth-query'
import { useLocationSearch } from '@/lib/use-location-search'

export function LoginForm() {
  const router = useRouter()
  const search = useLocationSearch()
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    const { data, error } = await authClient.signIn.email({
      email: String(form.get('email')),
      password: String(form.get('password')),
      fetchOptions: { body: { oauth_query: signedOAuthQuery(search) } },
    })
    setPending(false)
    if (error) return setError(error.message ?? 'Sign in failed')
    if (data.redirect) return
    router.push('/')
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl">Sign in</h1>
        <p className="text-muted-foreground">Welcome back.</p>
      </div>
      <form onSubmit={onSubmit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>
          <FieldError>{error}</FieldError>
          <Button type="submit" disabled={pending}>
            {pending ? 'Signing in…' : 'Sign in'}
          </Button>
          <p className="text-sm text-muted-foreground">
            No account?{' '}
            <Link href={`/signup${search}`} className="text-primary underline underline-offset-4">
              Sign up
            </Link>
          </p>
        </FieldGroup>
      </form>
    </div>
  )
}
