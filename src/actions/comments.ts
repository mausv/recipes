'use server'

import { revalidatePath } from 'next/cache'
import * as comments from '@/lib/comments'
import { requireUser } from '@/lib/session'
import { type CommentInput, commentSchema } from '@/lib/validation/comment'

export async function addComment(input: CommentInput) {
  const user = await requireUser()
  const parsed = commentSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { recipeId, text } = parsed.data
  const result = comments.addComment(user.id, recipeId, text)
  if ('error' in result) return { error: result.error }
  revalidatePath(`/recipes/${recipeId}`)
  return { id: result.id }
}

export async function deleteComment(id: string) {
  const user = await requireUser()
  const result = comments.deleteComment(user.id, id)
  if ('error' in result) return { error: result.error }
  revalidatePath(`/recipes/${result.recipeId}`)
  return {}
}
