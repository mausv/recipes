import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { recipe, recipeNote } from '@/db/schema'

export function getNote(userId: string, recipeId: string) {
  return db
    .select({ text: recipeNote.text, updatedAt: recipeNote.updatedAt })
    .from(recipeNote)
    .where(and(eq(recipeNote.recipeId, recipeId), eq(recipeNote.userId, userId)))
    .get()
}

export function saveNote(userId: string, recipeId: string, text: string) {
  const found = db.select({ id: recipe.id }).from(recipe).where(eq(recipe.id, recipeId)).get()
  if (!found) return { error: 'Recipe not found' }

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
