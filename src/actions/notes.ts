'use server'

import { revalidatePath } from 'next/cache'
import * as notes from '@/lib/notes'
import { requireUser } from '@/lib/session'
import { type NoteInput, noteSchema } from '@/lib/validation/note'

export async function saveNote(input: NoteInput) {
  const user = await requireUser()
  const parsed = noteSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { recipeId, text } = parsed.data
  const result = notes.saveNote(user.id, recipeId, text)
  if (result.error === undefined) revalidatePath(`/recipes/${recipeId}`)
  return result
}
