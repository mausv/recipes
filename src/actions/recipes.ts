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
  await requireUser()
  const parsed = recipeSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const result = await recipes.updateRecipe(id, parsed.data)
  if (result.error === undefined) {
    revalidatePath('/')
    revalidatePath(`/recipes/${id}`)
  }
  return result
}

export async function deleteRecipe(id: string) {
  await requireUser()
  const result = await recipes.deleteRecipe(id)
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
  await requireUser()
  const result = await recipes.setCoverImage(recipeId, imageId)
  if (result.error === undefined) {
    revalidatePath('/')
    revalidatePath(`/recipes/${recipeId}`)
  }
  return result
}
