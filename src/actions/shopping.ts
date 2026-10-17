'use server'

import { revalidatePath } from 'next/cache'
import { getActiveGroup } from '@/lib/active-group'
import { mondayOf } from '@/lib/meal-plan'
import { requireUser } from '@/lib/session'
import * as shoppingList from '@/lib/shopping-list'
import { dateSchema } from '@/lib/validation/meal-plan'
import {
  type AddRecipeInput,
  addRecipeSchema,
  type PantryItemInput,
  pantryItemSchema,
  type ShoppingItemInput,
  shoppingItemSchema,
} from '@/lib/validation/shopping'

async function activeGroupId() {
  const user = await requireUser()
  return (await getActiveGroup(user.id)).id
}

export async function addRecipeToShoppingList(input: AddRecipeInput) {
  const user = await requireUser()
  const parsed = addRecipeSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { id: groupId } = await getActiveGroup(user.id)
  const { recipeId, servings } = parsed.data
  const result = shoppingList.addRecipeToShoppingList(groupId, user.id, recipeId, servings)
  if (result.error === undefined) revalidatePath('/shopping')
  return result
}

export async function addWeekToShoppingList(week: string) {
  const user = await requireUser()
  const parsed = dateSchema.safeParse(week)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { id: groupId } = await getActiveGroup(user.id)
  const result = shoppingList.addWeekToShoppingList(groupId, user.id, mondayOf(parsed.data))
  if (result.added) revalidatePath('/shopping')
  return result
}

export async function addShoppingItem(input: ShoppingItemInput) {
  const groupId = await activeGroupId()
  const parsed = shoppingItemSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const result = shoppingList.addShoppingItem(groupId, parsed.data)
  if ('error' in result) return { error: result.error }
  revalidatePath('/shopping')
  return {}
}

export async function toggleShoppingItems(ids: string[], checked: boolean) {
  shoppingList.setShoppingItemsChecked(await activeGroupId(), ids, checked)
  revalidatePath('/shopping')
  return {}
}

export async function removeShoppingItems(ids: string[]) {
  shoppingList.removeShoppingItems(await activeGroupId(), ids)
  revalidatePath('/shopping')
  return {}
}

export async function clearCheckedItems() {
  shoppingList.clearCheckedItems(await activeGroupId())
  revalidatePath('/shopping')
  return {}
}

export async function clearShoppingList() {
  shoppingList.clearShoppingList(await activeGroupId())
  revalidatePath('/shopping')
  return {}
}

export async function setPantryItem(input: PantryItemInput) {
  const groupId = await activeGroupId()
  const parsed = pantryItemSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const result = shoppingList.setPantryItem(groupId, parsed.data)
  if (result.error === undefined) revalidatePath('/shopping')
  return result
}

export async function removePantryItem(ingredientId: string) {
  shoppingList.removePantryItem(await activeGroupId(), ingredientId)
  revalidatePath('/shopping')
  return {}
}

export async function markBoughtIntoPantry() {
  const result = shoppingList.moveBoughtToPantry(await activeGroupId())
  revalidatePath('/shopping')
  return result
}
