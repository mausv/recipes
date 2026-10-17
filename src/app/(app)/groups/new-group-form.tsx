'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { createGroup } from '@/actions/groups'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

export function NewGroupForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()

  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const result = await createGroup({ name })
      if (result.error !== undefined) {
        setError(result.error)
        return
      }
      router.push(`/groups/${result.id}`)
    })
  }

  return (
    <form onSubmit={submit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="group-name">New group</FieldLabel>
          <div className="flex gap-2">
            <Input
              id="group-name"
              placeholder="Weekend cabin"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? 'Creating…' : 'Create group'}
            </Button>
          </div>
          {error && <FieldError>{error}</FieldError>}
        </Field>
      </FieldGroup>
    </form>
  )
}
