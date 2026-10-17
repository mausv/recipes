'use client'

import { Trash2 } from 'lucide-react'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { deleteComment } from '@/actions/comments'
import { Button } from '@/components/ui/button'

export function DeleteCommentButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition()

  function remove() {
    startTransition(async () => {
      const result = await deleteComment(id)
      if (result.error !== undefined) toast.error(result.error)
    })
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Delete comment"
      disabled={pending}
      onClick={remove}
    >
      <Trash2 />
    </Button>
  )
}
