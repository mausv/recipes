import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { setupTestDb } from '@/test/db'

const { db, schema, insertUser, insertGroup, insertRecipe, insertIngredient, shareInto } =
  await setupTestDb()
const {
  acceptInvite,
  createGroup,
  createInvite,
  defaultGroup,
  deleteGroup,
  getGroup,
  getInviteGroup,
  isAdmin,
  isMember,
  leaveGroup,
  listGroups,
  listInvites,
  listMembers,
  personalGroupName,
  promoteMember,
  removeMember,
  renameGroup,
  revokeInvite,
} = await import('./groups')

function invited(groupId: string, adminId: string) {
  const result = createInvite(groupId, adminId)
  if ('error' in result) throw new Error(result.error)
  return result
}

function expireInvite(id: string) {
  db.update(schema.groupInvite)
    .set({ expiresAt: new Date(Date.now() - 1000) })
    .where(eq(schema.groupInvite.id, id))
    .run()
}

describe('personalGroupName', () => {
  it('uses the first name', () => {
    expect(personalGroupName('Ana María López')).toBe('Ana’s kitchen')
  })
})

describe('createGroup', () => {
  it('stores the group with its creator', () => {
    const ana = insertUser()
    const created = createGroup(ana.id, 'Cabin')
    expect(getGroup(created.id)).toMatchObject({ name: 'Cabin', createdById: ana.id })
  })

  it('makes the creator an admin', () => {
    const ana = insertUser()
    const created = createGroup(ana.id, 'Cabin')
    expect(isAdmin(ana.id, created.id)).toBe(true)
  })
})

describe('listGroups', () => {
  it('lists the user’s groups with role and member count', () => {
    const ana = insertUser()
    const ben = insertUser()
    const home = insertGroup('Home', [ben.id, ana.id])
    expect(listGroups(ana.id)).toEqual([
      { id: home.id, name: 'Home', role: 'member', memberCount: 2 },
    ])
  })

  it('lists groups in the order they were joined', () => {
    const ana = insertUser()
    const first = insertGroup('First', [ana.id])
    const second = insertGroup('Second', [ana.id])
    expect(listGroups(ana.id).map((g) => g.id)).toEqual([first.id, second.id])
  })

  it('leaves out groups the user is not in', () => {
    const ana = insertUser()
    insertGroup('Other', [insertUser().id])
    expect(listGroups(ana.id)).toEqual([])
  })
})

describe('defaultGroup', () => {
  it('returns the earliest joined group', () => {
    const ana = insertUser()
    const first = insertGroup('First', [ana.id])
    insertGroup('Second', [ana.id])
    expect(defaultGroup(ana.id).id).toBe(first.id)
  })

  it('creates a personal group for a user without groups', () => {
    const ana = insertUser()
    expect(defaultGroup(ana.id)).toMatchObject({ name: 'Ana’s kitchen', role: 'admin' })
  })
})

describe('listMembers', () => {
  it('lists members with their name and role', () => {
    const ana = insertUser()
    const ben = insertUser()
    const home = insertGroup('Home', [ana.id, ben.id])
    expect(listMembers(home.id).map((m) => [m.userId, m.role])).toEqual([
      [ana.id, 'admin'],
      [ben.id, 'member'],
    ])
  })
})

describe('isMember and isAdmin', () => {
  const ana = insertUser()
  const ben = insertUser()
  const home = insertGroup('Home', [ana.id, ben.id])

  it('reports a member as a member but not an admin', () => {
    expect([isMember(ben.id, home.id), isAdmin(ben.id, home.id)]).toEqual([true, false])
  })

  it('reports an outsider as neither', () => {
    const zoe = insertUser()
    expect([isMember(zoe.id, home.id), isAdmin(zoe.id, home.id)]).toEqual([false, false])
  })
})

describe('renameGroup', () => {
  it('lets an admin rename the group', () => {
    const ana = insertUser()
    const home = insertGroup('Home', [ana.id])
    expect(renameGroup(ana.id, home.id, 'Flat')).toEqual({})
    expect(getGroup(home.id)?.name).toBe('Flat')
  })

  it('refuses a member', () => {
    const ana = insertUser()
    const ben = insertUser()
    const home = insertGroup('Home', [ana.id, ben.id])
    expect(renameGroup(ben.id, home.id, 'Flat')).toEqual({
      error: 'Only group admins can do that',
    })
  })
})

describe('leaveGroup', () => {
  it('removes a member from the group', () => {
    const ana = insertUser()
    const ben = insertUser()
    const home = insertGroup('Home', [ana.id, ben.id])
    expect(leaveGroup(ben.id, home.id)).toEqual({})
    expect(isMember(ben.id, home.id)).toBe(false)
  })

  it('refuses the last admin while other members remain', () => {
    const ana = insertUser()
    const ben = insertUser()
    const home = insertGroup('Home', [ana.id, ben.id])
    expect(leaveGroup(ana.id, home.id).error).toMatch(/only admin/)
    expect(isMember(ana.id, home.id)).toBe(true)
  })

  it('lets an admin leave when another admin remains', () => {
    const ana = insertUser()
    const ben = insertUser()
    const home = insertGroup('Home', [ana.id, ben.id])
    db.update(schema.groupMember)
      .set({ role: 'admin' })
      .where(eq(schema.groupMember.userId, ben.id))
      .run()
    expect(leaveGroup(ana.id, home.id)).toEqual({})
  })

  it('deletes the group when the last member leaves', () => {
    const ana = insertUser()
    const home = insertGroup('Home', [ana.id])
    leaveGroup(ana.id, home.id)
    expect(getGroup(home.id)).toBeUndefined()
  })

  it('returns an error for a group the user is not in', () => {
    const home = insertGroup('Home', [insertUser().id])
    expect(leaveGroup(insertUser().id, home.id)).toEqual({ error: 'Group not found' })
  })
})

describe('promoteMember', () => {
  it('lets an admin make a member an admin', () => {
    const ana = insertUser()
    const ben = insertUser()
    const home = insertGroup('Home', [ana.id, ben.id])
    expect(promoteMember(home.id, ana.id, ben.id)).toEqual({})
    expect(isAdmin(ben.id, home.id)).toBe(true)
  })

  it('refuses a member', () => {
    const ana = insertUser()
    const ben = insertUser()
    const zoe = insertUser()
    const home = insertGroup('Home', [ana.id, ben.id, zoe.id])
    expect(promoteMember(home.id, ben.id, zoe.id)).toEqual({
      error: 'Only group admins can do that',
    })
    expect(isAdmin(zoe.id, home.id)).toBe(false)
  })

  it('returns an error for someone who is not a member', () => {
    const ana = insertUser()
    const home = insertGroup('Home', [ana.id])
    expect(promoteMember(home.id, ana.id, insertUser().id)).toEqual({
      error: 'Member not found',
    })
  })

  it('lets the promoted member’s former only admin leave', () => {
    const ana = insertUser()
    const ben = insertUser()
    const home = insertGroup('Home', [ana.id, ben.id])
    promoteMember(home.id, ana.id, ben.id)
    expect(leaveGroup(ana.id, home.id)).toEqual({})
  })
})

describe('deleteGroup', () => {
  it('lets an admin delete the group', () => {
    const ana = insertUser()
    const home = insertGroup('Home', [ana.id, insertUser().id])
    expect(deleteGroup(home.id, ana.id)).toEqual({})
    expect(getGroup(home.id)).toBeUndefined()
  })

  it('refuses a member', () => {
    const ana = insertUser()
    const ben = insertUser()
    const home = insertGroup('Home', [ana.id, ben.id])
    expect(deleteGroup(home.id, ben.id)).toEqual({ error: 'Only group admins can do that' })
    expect(getGroup(home.id)).toBeDefined()
  })

  it('refuses an outsider', () => {
    const home = insertGroup('Home', [insertUser().id])
    expect(deleteGroup(home.id, insertUser().id)).toEqual({
      error: 'Only group admins can do that',
    })
  })

  it('removes memberships, invites, shares, shopping, pantry and meal plan', () => {
    const ana = insertUser()
    const home = insertGroup('Home', [ana.id])
    const recipe = insertRecipe(ana.id)
    const oats = insertIngredient(ana.id)
    invited(home.id, ana.id)
    shareInto(recipe.id, home.id, ana.id)
    db.insert(schema.shoppingItem).values({ groupId: home.id, name: 'Milk' }).run()
    db.insert(schema.pantryItem).values({ groupId: home.id, ingredientId: oats.id }).run()
    db.insert(schema.mealPlanEntry)
      .values({
        groupId: home.id,
        date: '2026-10-17',
        slot: 'dinner',
        recipeId: recipe.id,
        position: 0,
        createdById: ana.id,
      })
      .run()
    deleteGroup(home.id, ana.id)
    const left = [
      schema.groupMember,
      schema.groupInvite,
      schema.recipeShare,
      schema.shoppingItem,
      schema.pantryItem,
      schema.mealPlanEntry,
    ].map((table) => db.select().from(table).where(eq(table.groupId, home.id)).all().length)
    expect(left).toEqual([0, 0, 0, 0, 0, 0])
  })

  it('keeps the shared recipe itself', () => {
    const ana = insertUser()
    const home = insertGroup('Home', [ana.id])
    const recipe = insertRecipe(ana.id)
    shareInto(recipe.id, home.id, ana.id)
    deleteGroup(home.id, ana.id)
    expect(
      db.select().from(schema.recipe).where(eq(schema.recipe.id, recipe.id)).get()
    ).toBeDefined()
  })
})

describe('removeMember', () => {
  it('lets an admin remove a member', () => {
    const ana = insertUser()
    const ben = insertUser()
    const home = insertGroup('Home', [ana.id, ben.id])
    expect(removeMember(ana.id, home.id, ben.id)).toEqual({})
    expect(isMember(ben.id, home.id)).toBe(false)
  })

  it('refuses a member', () => {
    const ana = insertUser()
    const ben = insertUser()
    const home = insertGroup('Home', [ana.id, ben.id])
    expect(removeMember(ben.id, home.id, ana.id)).toEqual({
      error: 'Only group admins can do that',
    })
  })

  it('refuses to remove the admin themselves', () => {
    const ana = insertUser()
    const home = insertGroup('Home', [ana.id])
    expect(removeMember(ana.id, home.id, ana.id)).toEqual({ error: 'Use Leave to remove yourself' })
  })

  it('returns an error for someone who is not a member', () => {
    const ana = insertUser()
    const home = insertGroup('Home', [ana.id])
    expect(removeMember(ana.id, home.id, insertUser().id)).toEqual({ error: 'Member not found' })
  })
})

describe('createInvite', () => {
  it('returns a token that resolves to the group', () => {
    const ana = insertUser()
    const home = insertGroup('Home', [ana.id])
    expect(getInviteGroup(invited(home.id, ana.id).token)).toMatchObject({
      id: home.id,
      name: 'Home',
    })
  })

  it('stores only the SHA-256 hash of the token', () => {
    const ana = insertUser()
    const home = insertGroup('Home', [ana.id])
    const { id, token } = invited(home.id, ana.id)
    const stored = db.select().from(schema.groupInvite).where(eq(schema.groupInvite.id, id)).get()
    expect(stored?.tokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(stored?.tokenHash).not.toContain(token)
  })

  it('expires after seven days', () => {
    const ana = insertUser()
    const home = insertGroup('Home', [ana.id])
    const { expiresAt } = invited(home.id, ana.id)
    expect(expiresAt.getTime() - Date.now()).toBeCloseTo(7 * 24 * 60 * 60 * 1000, -4)
  })

  it('refuses a member', () => {
    const ana = insertUser()
    const ben = insertUser()
    const home = insertGroup('Home', [ana.id, ben.id])
    expect(createInvite(home.id, ben.id)).toEqual({ error: 'Only group admins can do that' })
  })
})

describe('getInviteGroup', () => {
  it('includes who created the invite and the member count', () => {
    const ana = insertUser()
    const home = insertGroup('Home', [ana.id, insertUser().id])
    expect(getInviteGroup(invited(home.id, ana.id).token)).toEqual({
      id: home.id,
      name: 'Home',
      invitedBy: 'Ana',
      memberCount: 2,
    })
  })

  it('returns nothing for a revoked invite', () => {
    const ana = insertUser()
    const home = insertGroup('Home', [ana.id])
    const { id, token } = invited(home.id, ana.id)
    revokeInvite(ana.id, id)
    expect(getInviteGroup(token)).toBeUndefined()
  })

  it('returns nothing for an expired invite', () => {
    const ana = insertUser()
    const home = insertGroup('Home', [ana.id])
    const { id, token } = invited(home.id, ana.id)
    expireInvite(id)
    expect(getInviteGroup(token)).toBeUndefined()
  })
})

describe('listInvites', () => {
  it('lists active invites with their creator', () => {
    const ana = insertUser()
    const home = insertGroup('Home', [ana.id])
    const { id } = invited(home.id, ana.id)
    expect(listInvites(home.id)).toMatchObject([{ id, createdBy: 'Ana' }])
  })

  it('leaves out revoked and expired invites', () => {
    const ana = insertUser()
    const home = insertGroup('Home', [ana.id])
    revokeInvite(ana.id, invited(home.id, ana.id).id)
    expireInvite(invited(home.id, ana.id).id)
    expect(listInvites(home.id)).toEqual([])
  })
})

describe('revokeInvite', () => {
  it('makes the token unusable', () => {
    const ana = insertUser()
    const home = insertGroup('Home', [ana.id])
    const { id, token } = invited(home.id, ana.id)
    expect(revokeInvite(ana.id, id)).toEqual({})
    expect(acceptInvite(token, insertUser().id)).toEqual({
      error: 'This invite link is invalid or has expired',
    })
  })

  it('refuses a member', () => {
    const ana = insertUser()
    const ben = insertUser()
    const home = insertGroup('Home', [ana.id, ben.id])
    expect(revokeInvite(ben.id, invited(home.id, ana.id).id)).toEqual({
      error: 'Only group admins can do that',
    })
  })

  it('hides invites of other groups', () => {
    const ana = insertUser()
    const home = insertGroup('Home', [ana.id])
    expect(revokeInvite(insertUser().id, invited(home.id, ana.id).id)).toEqual({
      error: 'Invite not found',
    })
  })
})

describe('acceptInvite', () => {
  it('adds the user as a member and returns the group', () => {
    const ana = insertUser()
    const ben = insertUser()
    const home = insertGroup('Home', [ana.id])
    expect(acceptInvite(invited(home.id, ana.id).token, ben.id)).toEqual({
      group: { id: home.id, name: 'Home' },
    })
    expect(isMember(ben.id, home.id)).toBe(true)
    expect(isAdmin(ben.id, home.id)).toBe(false)
  })

  it('can be used by several people', () => {
    const ana = insertUser()
    const home = insertGroup('Home', [ana.id])
    const { token } = invited(home.id, ana.id)
    acceptInvite(token, insertUser().id)
    acceptInvite(token, insertUser().id)
    expect(listMembers(home.id)).toHaveLength(3)
  })

  it('keeps an existing member’s role', () => {
    const ana = insertUser()
    const home = insertGroup('Home', [ana.id])
    expect(acceptInvite(invited(home.id, ana.id).token, ana.id)).toMatchObject({
      group: { id: home.id },
    })
    expect(isAdmin(ana.id, home.id)).toBe(true)
  })

  it('rejects an expired invite', () => {
    const ana = insertUser()
    const home = insertGroup('Home', [ana.id])
    const { id, token } = invited(home.id, ana.id)
    expireInvite(id)
    expect(acceptInvite(token, insertUser().id)).toEqual({
      error: 'This invite link is invalid or has expired',
    })
  })

  it('rejects an unknown token', () => {
    expect(acceptInvite('nope', insertUser().id)).toEqual({
      error: 'This invite link is invalid or has expired',
    })
  })
})
