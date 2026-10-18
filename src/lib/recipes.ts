import fs from 'node:fs/promises'
import { and, asc, desc, eq, exists, inArray, isNull, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  group,
  image,
  ingredient,
  recipe,
  recipeIngredient,
  recipeShare,
  recipeStep,
  user,
} from '@/db/schema'
import { canViewRecipe, isRecipeOwner } from './access'
import { isMember } from './groups'
import { deleteImage, imagePath } from './images'
import { computeRecipeBreakdown } from './nutrition'
import { isKnownUnit, toGrams } from './units'
import { likePattern } from './utils'
import type { RecipeData } from './validation/recipe'

export type RecipeScope = 'all' | 'mine' | 'group'

export function ownerError(userId: string, recipeId: string) {
  if (isRecipeOwner(userId, recipeId)) return undefined
  return canViewRecipe(userId, recipeId)
    ? 'Only the owner can delete or share this recipe'
    : 'Recipe not found'
}

export async function getRecipeWithNutrition(id: string, userId: string) {
  if (!canViewRecipe(userId, id)) return null
  const found = await db.query.recipe.findFirst({
    where: eq(recipe.id, id),
    with: {
      createdBy: { columns: { name: true } },
      coverImage: true,
      ingredients: { orderBy: asc(recipeIngredient.position), with: { ingredient: true } },
      steps: { orderBy: asc(recipeStep.position), with: { image: true } },
    },
  })
  if (!found) return null

  const { contributions, ...nutrition } = computeRecipeBreakdown({
    lines: found.ingredients,
    servings: found.servings,
    cookedWeightGrams: found.cookedWeightGrams,
  })
  return {
    ...found,
    ingredients: found.ingredients.map((line, i) => ({ ...line, macros: contributions[i] })),
    nutrition,
  }
}

function sharedInto(groupId: string) {
  return exists(
    db
      .select({ id: recipeShare.id })
      .from(recipeShare)
      .where(and(eq(recipeShare.recipeId, recipe.id), eq(recipeShare.groupId, groupId)))
  )
}

function scopeFilter(userId: string, groupId: string, scope: RecipeScope) {
  const mine = eq(recipe.createdById, userId)
  if (scope === 'mine') return mine
  if (scope === 'group') return sharedInto(groupId)
  return or(mine, sharedInto(groupId))
}

export function listRecipes({
  userId,
  groupId,
  scope,
  q,
  tag,
}: {
  userId: string
  groupId: string
  scope: RecipeScope
  q?: string
  tag?: string
}) {
  const filters = [scopeFilter(userId, groupId, scope)]
  if (q) {
    const pattern = likePattern(q)
    filters.push(
      sql`(${recipe.title} like ${pattern} escape '\\' or exists (select 1 from json_each(${recipe.tags}) where value like ${pattern} escape '\\'))`
    )
  }
  if (tag) {
    filters.push(sql`exists (select 1 from json_each(${recipe.tags}) where value = ${tag})`)
  }

  return db
    .select({
      id: recipe.id,
      title: recipe.title,
      servings: recipe.servings,
      tags: recipe.tags,
      coverImageId: recipe.coverImageId,
      createdById: recipe.createdById,
      ownerName: user.name,
      kcalPerServing: sql<number>`coalesce(sum(${recipeIngredient.grams} * ${ingredient.kcal} / 100), 0) / ${recipe.servings}`,
    })
    .from(recipe)
    .innerJoin(user, eq(user.id, recipe.createdById))
    .leftJoin(recipeIngredient, eq(recipeIngredient.recipeId, recipe.id))
    .leftJoin(ingredient, eq(ingredient.id, recipeIngredient.ingredientId))
    .where(and(...filters))
    .groupBy(recipe.id)
    .orderBy(desc(recipe.createdAt))
    .all()
}

export function listTags({
  userId,
  groupId,
  scope = 'all',
}: {
  userId: string
  groupId: string
  scope?: RecipeScope
}) {
  return db
    .all<{ tag: string }>(
      sql`select distinct value as tag from ${recipe}, json_each(${recipe.tags}) where ${scopeFilter(userId, groupId, scope)} order by value`
    )
    .map((row) => row.tag)
}

function resolveGrams(lines: RecipeData['ingredients']) {
  const ids = [...new Set(lines.map((l) => l.ingredientId))]
  const found = ids.length
    ? db.query.ingredient
        .findMany({ where: inArray(ingredient.id, ids), with: { units: true } })
        .sync()
    : []
  const byId = new Map(found.map((i) => [i.id, i]))

  const rows = []
  for (const [position, line] of lines.entries()) {
    const ing = byId.get(line.ingredientId)
    if (!ing) return { error: 'Unknown ingredient' }
    if (!isKnownUnit(line.unit, ing.units)) {
      return { error: `Unknown unit "${line.unit}" for ${ing.name}` }
    }
    rows.push({ ...line, position, grams: toGrams(line.quantity, line.unit, ing) })
  }
  return { rows }
}

function referencedImageIds(coverImageId: string | null, steps: { imageId: string | null }[]) {
  return [coverImageId, ...steps.map((s) => s.imageId)].filter((id) => id !== null)
}

export function createRecipe(userId: string, { ingredients, steps, ...values }: RecipeData) {
  const resolved = resolveGrams(ingredients)
  if (resolved.error !== undefined) return { error: resolved.error }

  const id = db.transaction((tx) => {
    const { id } = tx
      .insert(recipe)
      .values({ ...values, createdById: userId })
      .returning({ id: recipe.id })
      .get()
    if (resolved.rows.length) {
      tx.insert(recipeIngredient)
        .values(resolved.rows.map((row) => ({ ...row, recipeId: id })))
        .run()
    }
    if (steps.length) {
      tx.insert(recipeStep)
        .values(steps.map((step, position) => ({ ...step, position, recipeId: id })))
        .run()
    }
    const imageIds = referencedImageIds(values.coverImageId, steps)
    if (imageIds.length) {
      tx.update(image)
        .set({ recipeId: id })
        .where(and(inArray(image.id, imageIds), isNull(image.recipeId)))
        .run()
    }
    return id
  })
  return { id }
}

export async function updateRecipe(
  id: string,
  userId: string,
  { ingredients, steps, ...values }: RecipeData
) {
  if (!canViewRecipe(userId, id)) return { error: 'Recipe not found' }
  const resolved = resolveGrams(ingredients)
  if (resolved.error !== undefined) return { error: resolved.error }

  const imageIds = referencedImageIds(values.coverImageId, steps)
  db.transaction((tx) => {
    tx.update(recipe).set(values).where(eq(recipe.id, id)).run()
    tx.delete(recipeIngredient).where(eq(recipeIngredient.recipeId, id)).run()
    tx.delete(recipeStep).where(eq(recipeStep.recipeId, id)).run()
    if (resolved.rows.length) {
      tx.insert(recipeIngredient)
        .values(resolved.rows.map((row) => ({ ...row, recipeId: id })))
        .run()
    }
    if (steps.length) {
      tx.insert(recipeStep)
        .values(steps.map((step, position) => ({ ...step, position, recipeId: id })))
        .run()
    }
    if (imageIds.length) {
      tx.update(image)
        .set({ recipeId: id })
        .where(and(inArray(image.id, imageIds), isNull(image.recipeId)))
        .run()
    }
  })

  const unused = db
    .select({ id: image.id })
    .from(image)
    .where(eq(image.recipeId, id))
    .all()
    .filter((row) => !imageIds.includes(row.id))
  await Promise.all(unused.map((row) => deleteImage(row.id)))
  return { id }
}

export async function deleteRecipe(id: string, userId: string) {
  const error = ownerError(userId, id)
  if (error) return { error }
  const images = db.select({ id: image.id }).from(image).where(eq(image.recipeId, id)).all()
  await Promise.all(images.map((row) => deleteImage(row.id)))
  db.delete(recipe).where(eq(recipe.id, id)).run()
  return {}
}

export async function setCoverImage(recipeId: string, userId: string, imageId: string | null) {
  if (!canViewRecipe(userId, recipeId)) return { error: 'Recipe not found' }
  const current = db
    .select({ coverImageId: recipe.coverImageId })
    .from(recipe)
    .where(eq(recipe.id, recipeId))
    .get()
  if (!current) return { error: 'Recipe not found' }

  db.transaction((tx) => {
    tx.update(recipe).set({ coverImageId: imageId }).where(eq(recipe.id, recipeId)).run()
    if (imageId) {
      tx.update(image)
        .set({ recipeId })
        .where(and(eq(image.id, imageId), isNull(image.recipeId)))
        .run()
    }
  })

  const previous = current.coverImageId
  if (previous && previous !== imageId) {
    const usedByStep = db
      .select({ id: recipeStep.id })
      .from(recipeStep)
      .where(eq(recipeStep.imageId, previous))
      .get()
    if (!usedByStep) await deleteImage(previous)
  }
  return {}
}

export async function copyRecipe(recipeId: string, userId: string) {
  if (!canViewRecipe(userId, recipeId)) return { error: 'Recipe not found' }
  const source = db.query.recipe
    .findFirst({
      where: eq(recipe.id, recipeId),
      with: { ingredients: true, steps: true, images: true },
    })
    .sync()
  if (!source) return { error: 'Recipe not found' }

  const copies = source.images.map((img) => ({ ...img, newId: crypto.randomUUID() }))
  const copyOf = (id: string | null) => copies.find((img) => img.id === id)?.newId ?? null
  await Promise.all(copies.map((img) => fs.copyFile(imagePath(img.id), imagePath(img.newId))))

  const id = db.transaction((tx) => {
    const { id } = tx
      .insert(recipe)
      .values({
        title: source.title,
        description: source.description,
        servings: source.servings,
        cookedWeightGrams: source.cookedWeightGrams,
        tags: source.tags,
        createdById: userId,
      })
      .returning({ id: recipe.id })
      .get()
    if (copies.length) {
      tx.insert(image)
        .values(
          copies.map((img) => ({
            id: img.newId,
            recipeId: id,
            width: img.width,
            height: img.height,
          }))
        )
        .run()
      tx.update(recipe)
        .set({ coverImageId: copyOf(source.coverImageId) })
        .where(eq(recipe.id, id))
        .run()
    }
    if (source.ingredients.length) {
      tx.insert(recipeIngredient)
        .values(
          source.ingredients.map((line) => ({
            recipeId: id,
            ingredientId: line.ingredientId,
            quantity: line.quantity,
            unit: line.unit,
            grams: line.grams,
            groupName: line.groupName,
            position: line.position,
          }))
        )
        .run()
    }
    if (source.steps.length) {
      tx.insert(recipeStep)
        .values(
          source.steps.map((step) => ({
            recipeId: id,
            text: step.text,
            imageId: copyOf(step.imageId),
            position: step.position,
          }))
        )
        .run()
    }
    return id
  })
  return { id }
}

export function shareRecipe(recipeId: string, groupId: string, userId: string) {
  const error = ownerError(userId, recipeId)
  if (error) return { error }
  if (!isMember(userId, groupId)) return { error: 'Group not found' }
  db.insert(recipeShare)
    .values({ recipeId, groupId, sharedById: userId })
    .onConflictDoNothing()
    .run()
  return {}
}

export function unshareRecipe(recipeId: string, groupId: string, userId: string) {
  const error = ownerError(userId, recipeId)
  if (error) return { error }
  db.delete(recipeShare)
    .where(and(eq(recipeShare.recipeId, recipeId), eq(recipeShare.groupId, groupId)))
    .run()
  return {}
}

export function listRecipeShares(recipeId: string) {
  return db
    .select({ groupId: group.id, name: group.name })
    .from(recipeShare)
    .innerJoin(group, eq(group.id, recipeShare.groupId))
    .where(eq(recipeShare.recipeId, recipeId))
    .orderBy(asc(group.name))
    .all()
}
