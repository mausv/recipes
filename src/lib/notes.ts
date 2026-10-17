import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { recipeNote } from '@/db/schema'
import { canViewRecipe } from './access'

export function getNote(userId: string, recipeId: string) {
  return db
    .select({ text: recipeNote.text, updatedAt: recipeNote.updatedAt })
    .from(recipeNote)
    .where(and(eq(recipeNote.recipeId, recipeId), eq(recipeNote.userId, userId)))
    .get()
}

export function saveNote(userId: string, recipeId: string, text: string) {
  if (!canViewRecipe(userId, recipeId)) return { error: 'Recipe not found' }

  if (text) {
    db.insert(recipeNote)
      .values({ recipeId, userId, text })
      .onConflictDoUpdate({
        target: [recipeNote.recipeId, recipeNote.userId],
        set: { text, updatedAt: new Date() },
      })
      .run()
  } else {
    db.delete(recipeNote)
      .where(and(eq(recipeNote.recipeId, recipeId), eq(recipeNote.userId, userId)))
      .run()
  }
  return {}
}
