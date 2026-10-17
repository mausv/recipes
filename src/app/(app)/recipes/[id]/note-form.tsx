'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { saveNote } from '@/actions/notes'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export function NoteForm({ recipeId, text }: { recipeId: string; text: string }) {
  const [value, setValue] = useState(text)
  const [pending, startTransition] = useTransition()

  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const result = await saveNote({ recipeId, text: value })
      if (result.error !== undefined) toast.error(result.error)
      else toast.success(value.trim() ? 'Note saved' : 'Note removed')
    })
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Textarea
        aria-label="Your notes"
        placeholder="Tweaks, substitutions, what worked…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="min-h-24"
      />
      <Button type="submit" disabled={pending || value === text}>
        {pending ? 'Saving…' : 'Save note'}
      </Button>
    </form>
  )
}
