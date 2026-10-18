import { asc, eq, isNotNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import { ingredient, ingredientUnit, recipe, recipeIngredient } from '@/db/schema'
import { isKnownUnit, toGrams } from './units'
import { likePattern } from './utils'
import type { IngredientData } from './validation/ingredient'

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

export function listIngredientCategories() {
  return db
    .selectDistinct({ category: ingredient.category })
    .from(ingredient)
    .where(isNotNull(ingredient.category))
    .orderBy(asc(ingredient.category))
    .all()
    .map((row) => row.category)
    .filter((category) => category !== null)
}

export function groupByCategory<T extends { category: string | null }>(items: T[]) {
  const groups = new Map<string | null, T[]>()
  for (const item of items) {
    groups.set(item.category, [...(groups.get(item.category) ?? []), item])
  }
  return [...groups].sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : a.localeCompare(b)))
}

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
  const orphaned = lines.find((l) => !isKnownUnit(l.unit, units))
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
