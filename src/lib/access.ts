import { and, eq, exists, or } from 'drizzle-orm'
import { db } from '@/db'
import { groupMember, recipe, recipeShare } from '@/db/schema'

export function visibleRecipeFilter(userId: string) {
  return or(
    eq(recipe.createdById, userId),
    exists(
      db
        .select({ id: recipeShare.id })
        .from(recipeShare)
        .innerJoin(groupMember, eq(groupMember.groupId, recipeShare.groupId))
        .where(and(eq(recipeShare.recipeId, recipe.id), eq(groupMember.userId, userId)))
    )
  )
}

export function canViewRecipe(userId: string, recipeId: string) {
  return Boolean(
    db
      .select({ id: recipe.id })
      .from(recipe)
      .where(and(eq(recipe.id, recipeId), visibleRecipeFilter(userId)))
      .get()
  )
}

export function canEditRecipe(userId: string, recipeId: string) {
  return Boolean(
    db
      .select({ id: recipe.id })
      .from(recipe)
      .where(and(eq(recipe.id, recipeId), eq(recipe.createdById, userId)))
      .get()
  )
}
