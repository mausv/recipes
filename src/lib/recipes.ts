import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import { image, ingredient, recipe, recipeIngredient, recipeStep } from '@/db/schema'
import { deleteImage } from './images'
import { computeRecipeBreakdown } from './nutrition'
import { BASE_UNITS, toGrams } from './units'
import { likePattern } from './utils'
import type { RecipeData } from './validation/recipe'

export async function getRecipeWithNutrition(id: string) {
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

export function listRecipes({ q, tag }: { q?: string; tag?: string }) {
  const filters = []
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
      kcalPerServing: sql<number>`coalesce(sum(${recipeIngredient.grams} * ${ingredient.kcal} / 100), 0) / ${recipe.servings}`,
    })
    .from(recipe)
    .leftJoin(recipeIngredient, eq(recipeIngredient.recipeId, recipe.id))
    .leftJoin(ingredient, eq(ingredient.id, recipeIngredient.ingredientId))
    .where(and(...filters))
    .groupBy(recipe.id)
    .orderBy(desc(recipe.createdAt))
    .all()
}

export function listTags() {
  return db
    .all<{ tag: string }>(
      sql`select distinct value as tag from ${recipe}, json_each(${recipe.tags}) order by value`
    )
    .map((row) => row.tag)
}

const baseUnits: ReadonlySet<string> = new Set(BASE_UNITS)

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
    if (!baseUnits.has(line.unit) && !ing.units.some((u) => u.name === line.unit)) {
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

export async function updateRecipe(id: string, { ingredients, steps, ...values }: RecipeData) {
  const existing = db.select({ id: recipe.id }).from(recipe).where(eq(recipe.id, id)).get()
  if (!existing) return { error: 'Recipe not found' }
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

export async function deleteRecipe(id: string) {
  const existing = db.select({ id: recipe.id }).from(recipe).where(eq(recipe.id, id)).get()
  if (!existing) return { error: 'Recipe not found' }
  const images = db.select({ id: image.id }).from(image).where(eq(image.recipeId, id)).all()
  await Promise.all(images.map((row) => deleteImage(row.id)))
  db.delete(recipe).where(eq(recipe.id, id)).run()
  return {}
}

export async function setCoverImage(recipeId: string, imageId: string | null) {
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
