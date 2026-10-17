import { asc, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { ingredient, ingredientUnit, recipe, recipeIngredient } from '@/db/schema'
import { BASE_UNITS, toGrams } from './units'
import { likePattern } from './utils'
import type { IngredientData } from './validation/ingredient'

const baseUnits: ReadonlySet<string> = new Set(BASE_UNITS)

export function listIngredients(q?: string) {
  return db.query.ingredient
    .findMany({
      where: q
        ? sql`(${ingredient.name} like ${likePattern(q)} escape '\\' or ${ingredient.brand} like ${likePattern(q)} escape '\\')`
        : undefined,
      orderBy: asc(ingredient.name),
      with: { units: { columns: { name: true, grams: true }, orderBy: asc(ingredientUnit.name) } },
    })
    .sync()
}

export function getIngredient(id: string) {
  return db.query.ingredient
    .findFirst({
      where: eq(ingredient.id, id),
      with: { units: { columns: { name: true, grams: true }, orderBy: asc(ingredientUnit.name) } },
    })
    .sync()
}

export type IngredientWithUnits = ReturnType<typeof listIngredients>[number]

export function createIngredient(userId: string, { units, ...values }: IngredientData) {
  return db.transaction((tx) => {
    const { id } = tx
      .insert(ingredient)
      .values({ ...values, createdById: userId })
      .returning({ id: ingredient.id })
      .get()
    if (units.length) {
      tx.insert(ingredientUnit)
        .values(units.map((u) => ({ ...u, ingredientId: id })))
        .run()
    }
    return { id }
  })
}

export function updateIngredient(id: string, { units, ...values }: IngredientData) {
  const existing = db
    .select({ id: ingredient.id })
    .from(ingredient)
    .where(eq(ingredient.id, id))
    .get()
  if (!existing) return { error: 'Ingredient not found' }

  const lines = db
    .select({
      id: recipeIngredient.id,
      quantity: recipeIngredient.quantity,
      unit: recipeIngredient.unit,
      title: recipe.title,
    })
    .from(recipeIngredient)
    .innerJoin(recipe, eq(recipe.id, recipeIngredient.recipeId))
    .where(eq(recipeIngredient.ingredientId, id))
    .all()
  const orphaned = lines.find(
    (l) => !baseUnits.has(l.unit) && !units.some((u) => u.name === l.unit)
  )
  if (orphaned) {
    return { error: `Unit "${orphaned.unit}" is used by ${orphaned.title}` }
  }

  db.transaction((tx) => {
    tx.update(ingredient).set(values).where(eq(ingredient.id, id)).run()
    tx.delete(ingredientUnit).where(eq(ingredientUnit.ingredientId, id)).run()
    if (units.length) {
      tx.insert(ingredientUnit)
        .values(units.map((u) => ({ ...u, ingredientId: id })))
        .run()
    }
    for (const line of lines) {
      const grams = toGrams(line.quantity, line.unit, { density: values.density, units })
      tx.update(recipeIngredient).set({ grams }).where(eq(recipeIngredient.id, line.id)).run()
    }
  })
  return { id }
}

export function deleteIngredient(id: string) {
  const usedBy = db
    .selectDistinct({ title: recipe.title })
    .from(recipeIngredient)
    .innerJoin(recipe, eq(recipe.id, recipeIngredient.recipeId))
    .where(eq(recipeIngredient.ingredientId, id))
    .all()
  if (usedBy.length) {
    return {
      error: `Used by ${usedBy.map((r) => r.title).join(', ')}. Remove it from those recipes first.`,
    }
  }

  db.delete(ingredient).where(eq(ingredient.id, id)).run()
  return {}
}
