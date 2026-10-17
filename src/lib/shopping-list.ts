import { and, asc, eq, inArray, isNotNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import { ingredient, pantryItem, recipe, recipeIngredient, shoppingItem } from '@/db/schema'
import { applyPantry, mergeNeeds, scaleIngredientLines } from './shopping'
import { isKnownUnit, toGrams } from './units'
import type { PantryItemData, ShoppingItemData } from './validation/shopping'

function findIngredient(id: string) {
  return db.query.ingredient
    .findFirst({ where: eq(ingredient.id, id), with: { units: true } })
    .sync()
}

export function getShoppingList() {
  const items = db
    .select({
      id: shoppingItem.id,
      ingredientId: shoppingItem.ingredientId,
      name: shoppingItem.name,
      grams: shoppingItem.grams,
      quantity: shoppingItem.quantity,
      unit: shoppingItem.unit,
      recipeId: shoppingItem.recipeId,
      checked: shoppingItem.checked,
      recipe: { id: recipe.id, title: recipe.title },
    })
    .from(shoppingItem)
    .leftJoin(recipe, eq(recipe.id, shoppingItem.recipeId))
    .orderBy(asc(shoppingItem.name), asc(shoppingItem.createdAt))
    .all()
  const pantry = db
    .select({
      ingredientId: pantryItem.ingredientId,
      grams: pantryItem.grams,
      name: ingredient.name,
      brand: ingredient.brand,
    })
    .from(pantryItem)
    .innerJoin(ingredient, eq(ingredient.id, pantryItem.ingredientId))
    .orderBy(asc(ingredient.name))
    .all()

  const { needs, freeText } = mergeNeeds(items)
  return { needs: applyPantry(needs, pantry), freeText, pantry }
}

export function addRecipeToShoppingList(recipeId: string, servings: number) {
  const found = db.query.recipe
    .findFirst({
      where: eq(recipe.id, recipeId),
      columns: { servings: true },
      with: {
        ingredients: {
          orderBy: asc(recipeIngredient.position),
          with: { ingredient: { columns: { name: true } } },
        },
      },
    })
    .sync()
  if (!found) return { error: 'Recipe not found' }

  const lines = scaleIngredientLines(found.ingredients, found.servings, servings)
  if (lines.length) {
    db.insert(shoppingItem)
      .values(
        lines.map((l) => ({
          ingredientId: l.ingredientId,
          name: l.ingredient.name,
          grams: l.grams,
          quantity: l.quantity,
          unit: l.unit,
          recipeId,
        }))
      )
      .run()
  }
  return { added: lines.length }
}

export function addShoppingItem({ name, quantity, unit, ingredientId }: ShoppingItemData) {
  if (ingredientId === null) {
    return db
      .insert(shoppingItem)
      .values({ name, quantity, unit })
      .returning({ id: shoppingItem.id })
      .get()
  }
  const ing = findIngredient(ingredientId)
  if (!ing) return { error: 'Unknown ingredient' }
  const grams =
    quantity !== null && unit !== null && isKnownUnit(unit, ing.units)
      ? toGrams(quantity, unit, ing)
      : null
  return db
    .insert(shoppingItem)
    .values({ name: ing.name, ingredientId, grams, quantity, unit })
    .returning({ id: shoppingItem.id })
    .get()
}

export function setShoppingItemsChecked(ids: string[], checked: boolean) {
  db.update(shoppingItem).set({ checked }).where(inArray(shoppingItem.id, ids)).run()
}

export function removeShoppingItems(ids: string[]) {
  db.delete(shoppingItem).where(inArray(shoppingItem.id, ids)).run()
}

export function clearCheckedItems() {
  db.delete(shoppingItem).where(eq(shoppingItem.checked, true)).run()
}

export function clearShoppingList() {
  db.delete(shoppingItem).run()
}

export function setPantryItem({ ingredientId, grams }: PantryItemData) {
  if (!findIngredient(ingredientId)) return { error: 'Unknown ingredient' }
  db.insert(pantryItem)
    .values({ ingredientId, grams })
    .onConflictDoUpdate({ target: pantryItem.ingredientId, set: { grams } })
    .run()
  return {}
}

export function removePantryItem(ingredientId: string) {
  db.delete(pantryItem).where(eq(pantryItem.ingredientId, ingredientId)).run()
}

export function moveBoughtToPantry() {
  const bought = db
    .select()
    .from(shoppingItem)
    .where(and(eq(shoppingItem.checked, true), isNotNull(shoppingItem.ingredientId)))
    .all()
  const { needs } = mergeNeeds(bought)

  db.transaction((tx) => {
    for (const need of needs) {
      tx.insert(pantryItem)
        .values({ ingredientId: need.ingredientId, grams: need.grams })
        .onConflictDoUpdate({
          target: pantryItem.ingredientId,
          set: { grams: sql`${pantryItem.grams} + excluded.grams` },
        })
        .run()
    }
    tx.delete(shoppingItem)
      .where(
        inArray(
          shoppingItem.id,
          bought.map((item) => item.id)
        )
      )
      .run()
  })
  return { moved: needs.length }
}
