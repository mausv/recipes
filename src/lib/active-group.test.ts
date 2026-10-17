import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupTestDb } from '@/test/db'

const jar = vi.hoisted(() => new Map<string, string>())
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
  }),
}))

const { insertUser, insertGroup } = await setupTestDb()
const { getActiveGroup } = await import('./active-group')

const ana = insertUser()
const first = insertGroup('First', [ana.id])
const second = insertGroup('Second', [ana.id])
const foreign = insertGroup('Foreign', [insertUser().id])

beforeEach(() => jar.clear())

describe('getActiveGroup', () => {
  it('returns the group named by the cookie', async () => {
    jar.set('group', second.id)
    expect((await getActiveGroup(ana.id)).id).toBe(second.id)
  })

  it('falls back to the earliest joined group without a cookie', async () => {
    expect((await getActiveGroup(ana.id)).id).toBe(first.id)
  })

  it('ignores a cookie naming a group the user is not in', async () => {
    jar.set('group', foreign.id)
    expect((await getActiveGroup(ana.id)).id).toBe(first.id)
  })

  it('creates a personal group for a user without groups', async () => {
    const ben = insertUser()
    expect(await getActiveGroup(ben.id)).toMatchObject({ name: 'Ana’s kitchen', role: 'admin' })
  })
})
