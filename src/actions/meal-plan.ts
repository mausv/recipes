'use server'

import { revalidatePath } from 'next/cache'
import { getActiveGroup } from '@/lib/active-group'
import * as plan from '@/lib/meal-plan'
import { requireUser } from '@/lib/session'
import {
  type AddEntryInput,
  addEntrySchema,
  type MoveEntryInput,
  moveEntrySchema,
  type UpdateEntryInput,
  updateEntrySchema,
} from '@/lib/validation/meal-plan'

async function context() {
  const user = await requireUser()
  return { userId: user.id, groupId: (await getActiveGroup(user.id)).id }
}

function revalidated<T extends object>(result: T) {
  if (!('error' in result)) revalidatePath('/plan')
  return result
}

export async function addPlanEntry(input: AddEntryInput) {
  const { userId, groupId } = await context()
  const parsed = addEntrySchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  return revalidated(plan.addEntry(groupId, userId, parsed.data))
}

export async function updatePlanEntry(id: string, input: UpdateEntryInput) {
  const { userId, groupId } = await context()
  const parsed = updateEntrySchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  return revalidated(plan.updateEntry(groupId, userId, id, parsed.data))
}

export async function movePlanEntry(id: string, input: MoveEntryInput) {
  const { userId, groupId } = await context()
  const parsed = moveEntrySchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  return revalidated(plan.moveEntry(groupId, userId, id, parsed.data))
}

export async function removePlanEntry(id: string) {
  const { userId, groupId } = await context()
  return revalidated(plan.removeEntry(groupId, userId, id))
}
