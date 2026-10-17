import { revalidatePath } from 'next/cache'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requireUser } from '@/lib/session'
import { setupTestDb } from '@/test/db'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/session', () => ({ requireUser: vi.fn() }))

const { db, schema, insertUser } = await setupTestDb()
const { listConnectedClients } = await import('@/lib/oauth')
const { revokeOAuthClient } = await import('./oauth')

const ana = insertUser()

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireUser).mockResolvedValue(ana)
})

function connected() {
  const clientId = crypto.randomUUID()
  db.insert(schema.oauthClient)
    .values({ id: crypto.randomUUID(), clientId, redirectUris: [] })
    .run()
  db.insert(schema.oauthConsent)
    .values({
      id: crypto.randomUUID(),
      clientId,
      userId: ana.id,
      scopes: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .run()
  return clientId
}

describe('revokeOAuthClient', () => {
  it('revokes the signed-in user’s connection', async () => {
    const clientId = connected()
    expect(await revokeOAuthClient(clientId)).toEqual({})
    expect(listConnectedClients(ana.id).map((c) => c.clientId)).not.toContain(clientId)
  })

  it('revalidates the settings page', async () => {
    await revokeOAuthClient(connected())
    expect(revalidatePath).toHaveBeenCalledWith('/settings')
  })

  it('returns an error for an unknown connection', async () => {
    expect(await revokeOAuthClient('nope')).toEqual({ error: 'Connection not found' })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('refuses to run without a signed-in user', async () => {
    const clientId = connected()
    vi.mocked(requireUser).mockRejectedValue(new Error('NEXT_REDIRECT'))
    await expect(revokeOAuthClient(clientId)).rejects.toThrow()
    expect(listConnectedClients(ana.id).map((c) => c.clientId)).toContain(clientId)
  })
})
