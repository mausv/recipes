import { cookies } from 'next/headers'
import { defaultGroup, listGroups } from './groups'

export const ACTIVE_GROUP_COOKIE = 'group'

export async function getActiveGroup(userId: string) {
  const wanted = (await cookies()).get(ACTIVE_GROUP_COOKIE)?.value
  return listGroups(userId).find((g) => g.id === wanted) ?? defaultGroup(userId)
}
