'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { ACTIVE_GROUP_COOKIE } from '@/lib/active-group'
import * as groups from '@/lib/groups'
import { requireUser } from '@/lib/session'
import { type GroupInput, groupSchema } from '@/lib/validation/group'

async function activate(groupId: string) {
  const store = await cookies()
  store.set(ACTIVE_GROUP_COOKIE, groupId, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 365 * 24 * 60 * 60,
    path: '/',
  })
  revalidatePath('/', 'layout')
}

export async function setActiveGroup(groupId: string) {
  const user = await requireUser()
  if (!groups.isMember(user.id, groupId)) return { error: 'Group not found' }
  await activate(groupId)
  return {}
}

export async function createGroup(input: GroupInput) {
  const user = await requireUser()
  const parsed = groupSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { id } = groups.createGroup(user.id, parsed.data.name)
  revalidatePath('/', 'layout')
  return { id }
}

export async function renameGroup(groupId: string, input: GroupInput) {
  const user = await requireUser()
  const parsed = groupSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const result = groups.renameGroup(user.id, groupId, parsed.data.name)
  if (result.error === undefined) revalidatePath('/', 'layout')
  return result
}

export async function createInvite(groupId: string) {
  const user = await requireUser()
  const result = groups.createInvite(groupId, user.id)
  if ('error' in result) return { error: result.error }
  revalidatePath('/settings')
  return { url: new URL(`/join/${result.token}`, process.env.BETTER_AUTH_URL).href }
}

export async function revokeInvite(inviteId: string) {
  const user = await requireUser()
  const result = groups.revokeInvite(user.id, inviteId)
  if (result.error === undefined) revalidatePath('/settings')
  return result
}

export async function leaveGroup(groupId: string) {
  const user = await requireUser()
  const result = groups.leaveGroup(user.id, groupId)
  if (result.error === undefined) revalidatePath('/', 'layout')
  return result
}

export async function removeMember(groupId: string, userId: string) {
  const user = await requireUser()
  const result = groups.removeMember(user.id, groupId, userId)
  if (result.error === undefined) revalidatePath('/settings')
  return result
}

export async function acceptInvite(token: string) {
  const user = await requireUser()
  const result = groups.acceptInvite(token, user.id)
  if ('error' in result) return { error: result.error }
  await activate(result.group.id)
  return { groupId: result.group.id }
}
