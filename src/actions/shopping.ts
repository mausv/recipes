'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/session'
import * as shoppingList from '@/lib/shopping-list'
import {
  type AddRecipeInput,
  addRecipeSchema,
  type PantryItemInput,
  pantryItemSchema,
  type ShoppingItemInput,
  shoppingItemSchema,
} from '@/lib/validation/shopping'

export async function addRecipeToShoppingList(input: AddRecipeInput) {
  await requireUser()
  const parsed = addRecipeSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const result = shoppingList.addRecipeToShoppingList(parsed.data.recipeId, parsed.data.servings)
  if (result.error === undefined) revalidatePath('/shopping')
  return result
}

export async function addShoppingItem(input: ShoppingItemInput) {
  await requireUser()
  const parsed = shoppingItemSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const result = shoppingList.addShoppingItem(parsed.data)
  if ('error' in result) return { error: result.error }
  revalidatePath('/shopping')
  return {}
}

export async function toggleShoppingItems(ids: string[], checked: boolean) {
  await requireUser()
  shoppingList.setShoppingItemsChecked(ids, checked)
  revalidatePath('/shopping')
  return {}
}

export async function removeShoppingItems(ids: string[]) {
  await requireUser()
  shoppingList.removeShoppingItems(ids)
  revalidatePath('/shopping')
  return {}
}

export async function clearCheckedItems() {
  await requireUser()
  shoppingList.clearCheckedItems()
  revalidatePath('/shopping')
  return {}
}

export async function clearShoppingList() {
  await requireUser()
  shoppingList.clearShoppingList()
  revalidatePath('/shopping')
  return {}
}

export async function setPantryItem(input: PantryItemInput) {
  await requireUser()
  const parsed = pantryItemSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const result = shoppingList.setPantryItem(parsed.data)
  if (result.error === undefined) revalidatePath('/shopping')
  return result
}

export async function removePantryItem(ingredientId: string) {
  await requireUser()
  shoppingList.removePantryItem(ingredientId)
  revalidatePath('/shopping')
  return {}
}

export async function markBoughtIntoPantry() {
  await requireUser()
  const result = shoppingList.moveBoughtToPantry()
  revalidatePath('/shopping')
  return result
}
