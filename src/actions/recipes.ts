'use server'

import { revalidatePath } from 'next/cache'
import { deleteOrphanImages, saveImage } from '@/lib/images'
import * as recipes from '@/lib/recipes'
import { requireUser } from '@/lib/session'
import { type RecipeInput, recipeSchema } from '@/lib/validation/recipe'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024

export async function createRecipe(input: RecipeInput) {
  const user = await requireUser()
  const parsed = recipeSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const result = recipes.createRecipe(user.id, parsed.data)
  if (result.error === undefined) revalidatePath('/')
  return result
}

export async function updateRecipe(id: string, input: RecipeInput) {
  const user = await requireUser()
  const parsed = recipeSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const result = await recipes.updateRecipe(id, user.id, parsed.data)
  if (result.error === undefined) {
    revalidatePath('/')
    revalidatePath(`/recipes/${id}`)
  }
  return result
}

export async function deleteRecipe(id: string) {
  const user = await requireUser()
  const result = await recipes.deleteRecipe(id, user.id)
  if (result.error === undefined) revalidatePath('/')
  return result
}

export async function uploadRecipeImage(formData: FormData) {
  await requireUser()
  const file = formData.get('file')
  if (!(file instanceof File) || !file.type.startsWith('image/')) {
    return { error: 'Choose an image file' }
  }
  if (file.size > MAX_IMAGE_BYTES) return { error: 'Image must be 10 MB or smaller' }

  const saved = await saveImage(Buffer.from(await file.arrayBuffer()))
  await deleteOrphanImages()
  return { id: saved.id }
}

export async function setCoverImage(recipeId: string, imageId: string | null) {
  const user = await requireUser()
  const result = await recipes.setCoverImage(recipeId, user.id, imageId)
  if (result.error === undefined) {
    revalidatePath('/')
    revalidatePath(`/recipes/${recipeId}`)
  }
  return result
}

export async function copyRecipe(recipeId: string) {
  const user = await requireUser()
  const result = await recipes.copyRecipe(recipeId, user.id)
  if (result.error === undefined) revalidatePath('/')
  return result
}

export async function shareRecipe(recipeId: string, groupId: string) {
  const user = await requireUser()
  const result = recipes.shareRecipe(recipeId, groupId, user.id)
  if (result.error === undefined) {
    revalidatePath('/')
    revalidatePath(`/recipes/${recipeId}`)
  }
  return result
}

export async function unshareRecipe(recipeId: string, groupId: string) {
  const user = await requireUser()
  const result = recipes.unshareRecipe(recipeId, groupId, user.id)
  if (result.error === undefined) {
    revalidatePath('/')
    revalidatePath(`/recipes/${recipeId}`)
  }
  return result
}
