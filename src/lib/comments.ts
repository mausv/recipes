import { asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { recipeComment } from '@/db/schema'
import { canViewRecipe } from './access'

export function listComments(userId: string, recipeId: string) {
  if (!canViewRecipe(userId, recipeId)) return []
  return db.query.recipeComment
    .findMany({
      where: eq(recipeComment.recipeId, recipeId),
      orderBy: asc(recipeComment.createdAt),
      with: { user: { columns: { name: true } } },
    })
    .sync()
}

export function addComment(userId: string, recipeId: string, text: string) {
  if (!canViewRecipe(userId, recipeId)) return { error: 'Recipe not found' }
  return db
    .insert(recipeComment)
    .values({ recipeId, text, userId })
    .returning({ id: recipeComment.id })
    .get()
}

export function deleteComment(userId: string, id: string) {
  const comment = db
    .select({ userId: recipeComment.userId, recipeId: recipeComment.recipeId })
    .from(recipeComment)
    .where(eq(recipeComment.id, id))
    .get()
  if (!comment) return { error: 'Comment not found' }
  if (comment.userId !== userId) return { error: 'You can only delete your own comments' }

  db.delete(recipeComment).where(eq(recipeComment.id, id)).run()
  return { recipeId: comment.recipeId }
}
