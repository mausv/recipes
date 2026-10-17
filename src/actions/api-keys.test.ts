import { revalidatePath } from 'next/cache'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requireUser } from '@/lib/session'
import { setupTestDb } from '@/test/db'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/session', () => ({ requireUser: vi.fn() }))

const { insertUser } = await setupTestDb()
const { listApiKeys, verifyApiKey } = await import('@/lib/api-keys')
const { createApiKey, revokeApiKey } = await import('./api-keys')

const ana = insertUser()
const ben = insertUser()

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireUser).mockResolvedValue(ana)
})

async function created(name = 'Laptop') {
  const result = await createApiKey({ name })
  if (result.error !== undefined) throw new Error(result.error)
  return result
}

describe('createApiKey', () => {
  it('returns the plaintext key for the signed-in user', async () => {
    const { key } = await created()
    expect(verifyApiKey(key)).toBe(ana.id)
  })

  it('stores the trimmed name', async () => {
    const { id } = await created('  Claude Code  ')
    expect(listApiKeys(ana.id).find((k) => k.id === id)?.name).toBe('Claude Code')
  })

  it('rejects a blank name', async () => {
    expect(await createApiKey({ name: '  ' })).toEqual({ error: 'Name is required' })
  })

  it('revalidates the settings page', async () => {
    await created()
    expect(revalidatePath).toHaveBeenCalledWith('/settings')
  })

  it('refuses to run without a signed-in user', async () => {
    vi.mocked(requireUser).mockRejectedValue(new Error('NEXT_REDIRECT'))
    const before = listApiKeys(ana.id).length
    await expect(createApiKey({ name: 'Laptop' })).rejects.toThrow()
    expect(listApiKeys(ana.id)).toHaveLength(before)
  })
})

describe('revokeApiKey', () => {
  it('revokes the key', async () => {
    const { id, key } = await created()
    expect(await revokeApiKey(id)).toEqual({})
    expect(verifyApiKey(key)).toBeNull()
  })

  it('refuses to revoke another user’s key', async () => {
    const { id, key } = await created()
    vi.mocked(requireUser).mockResolvedValue(ben)
    expect(await revokeApiKey(id)).toEqual({ error: 'API key not found' })
    expect(verifyApiKey(key)).toBe(ana.id)
  })

  it('revalidates the settings page', async () => {
    const { id } = await created()
    vi.clearAllMocks()
    await revokeApiKey(id)
    expect(revalidatePath).toHaveBeenCalledWith('/settings')
  })

  it('refuses to run without a signed-in user', async () => {
    const { id, key } = await created()
    vi.mocked(requireUser).mockRejectedValue(new Error('NEXT_REDIRECT'))
    await expect(revokeApiKey(id)).rejects.toThrow()
    expect(verifyApiKey(key)).toBe(ana.id)
  })
})
