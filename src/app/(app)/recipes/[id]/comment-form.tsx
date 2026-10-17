'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { addComment } from '@/actions/comments'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export function CommentForm({ recipeId }: { recipeId: string }) {
  const [text, setText] = useState('')
  const [pending, startTransition] = useTransition()

  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const result = await addComment({ recipeId, text })
      if (result.error !== undefined) toast.error(result.error)
      else setText('')
    })
  }

  return (
    <form onSubmit={submit} className="flex items-end gap-2">
      <Textarea
        aria-label="Comment"
        placeholder="Add a comment"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <Button type="submit" disabled={pending || !text.trim()}>
        {pending ? 'Posting…' : 'Post'}
      </Button>
    </form>
  )
}
