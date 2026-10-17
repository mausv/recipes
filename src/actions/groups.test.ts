import { revalidatePath } from 'next/cache'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requireUser } from '@/lib/session'
import { setupTestDb } from '@/test/db'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/session', () => ({ requireUser: vi.fn() }))

const setCookie = vi.hoisted(() => vi.fn())
vi.mock('next/headers', () => ({ cookies: async () => ({ set: setCookie }) }))

const { insertUser, insertGroup } = await setupTestDb()
const groups = await import('@/lib/groups')
const {
  acceptInvite,
  createGroup,
  createInvite,
  leaveGroup,
  removeMember,
  renameGroup,
  revokeInvite,
  setActiveGroup,
} = await import('./groups')

const ana = insertUser()
const ben = insertUser()

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireUser).mockResolvedValue(ana)
})

function tokenOf(url: string) {
  return url.split('/join/')[1]
}

async function inviteUrl(groupId: string) {
  const result = await createInvite(groupId)
  if (!result.url) throw new Error(result.error)
  return result.url
}

describe('setActiveGroup', () => {
  it('stores the group in a long-lived httpOnly cookie', async () => {
    const home = insertGroup('Home', [ana.id])
    expect(await setActiveGroup(home.id)).toEqual({})
    expect(setCookie).toHaveBeenCalledWith('group', home.id, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 365 * 24 * 60 * 60,
      path: '/',
    })
  })

  it('refuses a group the user is not in', async () => {
    const foreign = insertGroup('Foreign', [ben.id])
    expect(await setActiveGroup(foreign.id)).toEqual({ error: 'Group not found' })
    expect(setCookie).not.toHaveBeenCalled()
  })

  it('revalidates every page', async () => {
    await setActiveGroup(insertGroup('Home', [ana.id]).id)
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout')
  })

  it('refuses to run without a signed-in user', async () => {
    vi.mocked(requireUser).mockRejectedValue(new Error('NEXT_REDIRECT'))
    await expect(setActiveGroup(insertGroup('Home', [ana.id]).id)).rejects.toThrow()
    expect(setCookie).not.toHaveBeenCalled()
  })
})

describe('createGroup', () => {
  it('creates a group with the signed-in user as admin', async () => {
    const result = await createGroup({ name: '  Cabin  ' })
    if (result.error !== undefined) throw new Error(result.error)
    expect(groups.getGroup(result.id)?.name).toBe('Cabin')
    expect(groups.isAdmin(ana.id, result.id)).toBe(true)
  })

  it('rejects a blank name', async () => {
    expect(await createGroup({ name: ' ' })).toEqual({ error: 'Name is required' })
  })
})

describe('renameGroup', () => {
  it('renames the group', async () => {
    const home = insertGroup('Home', [ana.id])
    expect(await renameGroup(home.id, { name: 'Flat' })).toEqual({})
    expect(groups.getGroup(home.id)?.name).toBe('Flat')
  })

  it('returns the lib error for a member', async () => {
    const home = insertGroup('Home', [ben.id, ana.id])
    expect(await renameGroup(home.id, { name: 'Flat' })).toEqual({
      error: 'Only group admins can do that',
    })
  })
})

describe('createInvite', () => {
  it('returns the full join URL', async () => {
    const home = insertGroup('Home', [ana.id])
    expect(await inviteUrl(home.id)).toMatch(/^http:\/\/localhost:3000\/join\/[\w-]+$/)
  })

  it('returns a URL whose token joins the group', async () => {
    const home = insertGroup('Home', [ana.id])
    const token = tokenOf(await inviteUrl(home.id))
    expect(groups.getInviteGroup(token)?.id).toBe(home.id)
  })

  it('refuses a member', async () => {
    const home = insertGroup('Home', [ben.id, ana.id])
    expect(await createInvite(home.id)).toEqual({ error: 'Only group admins can do that' })
  })
})

describe('revokeInvite', () => {
  it('revokes the invite', async () => {
    const home = insertGroup('Home', [ana.id])
    await inviteUrl(home.id)
    const [invite] = groups.listInvites(home.id)
    expect(await revokeInvite(invite.id)).toEqual({})
    expect(groups.listInvites(home.id)).toEqual([])
  })
})

describe('leaveGroup', () => {
  it('removes the signed-in user from the group', async () => {
    const home = insertGroup('Home', [ben.id, ana.id])
    expect(await leaveGroup(home.id)).toEqual({})
    expect(groups.isMember(ana.id, home.id)).toBe(false)
  })
})

describe('removeMember', () => {
  it('removes the member', async () => {
    const home = insertGroup('Home', [ana.id, ben.id])
    expect(await removeMember(home.id, ben.id)).toEqual({})
    expect(groups.isMember(ben.id, home.id)).toBe(false)
  })
})

describe('acceptInvite', () => {
  it('joins the group and makes it active', async () => {
    const home = insertGroup('Home', [ben.id])
    vi.mocked(requireUser).mockResolvedValue(ben)
    const token = tokenOf(await inviteUrl(home.id))
    vi.mocked(requireUser).mockResolvedValue(ana)
    expect(await acceptInvite(token)).toEqual({ groupId: home.id })
    expect(groups.isMember(ana.id, home.id)).toBe(true)
    expect(setCookie).toHaveBeenCalledWith('group', home.id, expect.anything())
  })

  it('returns an error for an invalid token', async () => {
    expect(await acceptInvite('nope')).toEqual({
      error: 'This invite link is invalid or has expired',
    })
    expect(setCookie).not.toHaveBeenCalled()
  })
})
