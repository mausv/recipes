'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { saveNote } from '@/actions/notes'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useT, useTError } from '@/i18n/client'

export function NoteForm({ recipeId, text }: { recipeId: string; text: string }) {
  const t = useT()
  const tError = useTError()
  const [value, setValue] = useState(text)
  const [pending, startTransition] = useTransition()

  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const result = await saveNote({ recipeId, text: value })
      if (result.error !== undefined) toast.error(tError(result.error))
      else toast.success(value.trim() ? t.recipes.noteSaved : t.recipes.noteRemoved)
    })
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Textarea
        aria-label={t.recipes.yourNotes}
        placeholder={t.recipes.notePlaceholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="min-h-24"
      />
      <Button type="submit" disabled={pending || value === text}>
        {pending ? t.recipes.saving : t.recipes.saveNote}
      </Button>
    </form>
  )
}
