'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { addComment } from '@/actions/comments'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useT, useTError } from '@/i18n/client'

export function CommentForm({ recipeId }: { recipeId: string }) {
  const t = useT()
  const tError = useTError()
  const [text, setText] = useState('')
  const [pending, startTransition] = useTransition()

  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const result = await addComment({ recipeId, text })
      if (result.error !== undefined) toast.error(tError(result.error))
      else setText('')
    })
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Textarea
        aria-label={t.recipes.comment}
        placeholder={t.recipes.commentPlaceholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <Button type="submit" disabled={pending || !text.trim()}>
        {pending ? t.recipes.posting : t.recipes.postComment}
      </Button>
    </form>
  )
}
