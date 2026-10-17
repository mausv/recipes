'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/session'
import { importExport } from '@/lib/transfer'
import { importModeSchema } from '@/lib/validation/transfer'

export async function importRecipes(formData: FormData) {
  const user = await requireUser()
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose an export file' }
  const mode = importModeSchema.safeParse(formData.get('mode'))
  if (!mode.success) return { error: mode.error.issues[0].message }

  let json: unknown
  try {
    json = JSON.parse(await file.text())
  } catch {
    return { error: 'The file is not valid JSON' }
  }

  const result = await importExport(json, { userId: user.id, mode: mode.data })
  if (!('error' in result)) revalidatePath('/', 'layout')
  return result
}
