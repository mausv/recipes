'use client'

import { Pencil } from 'lucide-react'
import { useState, useTransition } from 'react'
import { renameGroup } from '@/actions/groups'
import { Button } from '@/components/ui/button'
import { Field, FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

export function RenameGroup({ groupId, name }: { groupId: string; name: string }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name)
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()

  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const result = await renameGroup(groupId, { name: value })
      if (result.error !== undefined) {
        setError(result.error)
        return
      }
      setError(undefined)
      setEditing(false)
    })
  }

  function cancel() {
    setValue(name)
    setError(undefined)
    setEditing(false)
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <h1 className="min-w-0 text-[32px] leading-tight tracking-[-0.01em]">{name}</h1>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Rename group"
          onClick={() => setEditing(true)}
        >
          <Pencil />
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={submit}>
      <Field>
        <div className="flex flex-wrap gap-2">
          <Input
            aria-label="Group name"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
            className="min-w-0 flex-1 basis-56"
          />
          <Button type="submit" disabled={pending || !value.trim()}>
            {pending ? 'Saving…' : 'Save name'}
          </Button>
          <Button type="button" variant="ghost" onClick={cancel}>
            Cancel
          </Button>
        </div>
        {error && <FieldError>{error}</FieldError>}
      </Field>
    </form>
  )
}
