'use server'

import { revalidatePath } from 'next/cache'
import * as ingredients from '@/lib/ingredients'
import { requireUser } from '@/lib/session'
import { type IngredientInput, ingredientSchema } from '@/lib/validation/ingredient'

export async function createIngredient(input: IngredientInput) {
  const user = await requireUser()
  const parsed = ingredientSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { id } = ingredients.createIngredient(user.id, parsed.data)
  revalidatePath('/ingredients')
  return { id }
}

export async function updateIngredient(id: string, input: IngredientInput) {
  await requireUser()
  const parsed = ingredientSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const result = ingredients.updateIngredient(id, parsed.data)
  if (result.error === undefined) revalidatePath('/', 'layout')
  return result
}

export async function deleteIngredient(id: string) {
  await requireUser()
  const result = ingredients.deleteIngredient(id)
  if (result.error === undefined) revalidatePath('/ingredients')
  return result
}
