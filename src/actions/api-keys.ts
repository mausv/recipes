'use server'

import { revalidatePath } from 'next/cache'
import * as apiKeys from '@/lib/api-keys'
import { requireUser } from '@/lib/session'
import { type ApiKeyInput, apiKeySchema } from '@/lib/validation/api-key'

export async function createApiKey(input: ApiKeyInput) {
  const user = await requireUser()
  const parsed = apiKeySchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { id, key } = apiKeys.createApiKey(user.id, parsed.data.name)
  revalidatePath('/settings')
  return { id, key }
}

export async function revokeApiKey(id: string) {
  const user = await requireUser()
  const result = apiKeys.revokeApiKey(user.id, id)
  if (result.error === undefined) revalidatePath('/settings')
  return result
}
