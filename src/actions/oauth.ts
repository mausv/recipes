'use server'

import { revalidatePath } from 'next/cache'
import * as oauth from '@/lib/oauth'
import { requireUser } from '@/lib/session'

export async function revokeOAuthClient(clientId: string) {
  const user = await requireUser()
  const result = oauth.revokeConnectedClient(user.id, clientId)
  if (result.error === undefined) revalidatePath('/settings')
  return result
}
