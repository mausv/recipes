import { createHash, randomBytes } from 'node:crypto'
import { and, asc, eq, gt, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import { group, groupInvite, groupMember, user } from '@/db/schema'

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const ADMIN_ONLY = 'Only group admins can do that'
const INVALID_INVITE = 'This invite link is invalid or has expired'

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function personalGroupName(name: string) {
  return `${name.trim().split(/\s+/)[0]}’s kitchen`
}

export function createGroup(userId: string, name: string) {
  return db.transaction((tx) => {
    const created = tx.insert(group).values({ name, createdById: userId }).returning().get()
    tx.insert(groupMember).values({ groupId: created.id, userId, role: 'admin' }).run()
    return created
  })
}

export function listGroups(userId: string) {
  return db
    .select({
      id: group.id,
      name: group.name,
      role: groupMember.role,
      memberCount: sql<number>`(select count(*) from ${groupMember} m where m.group_id = ${group.id})`,
    })
    .from(groupMember)
    .innerJoin(group, eq(group.id, groupMember.groupId))
    .where(eq(groupMember.userId, userId))
    .orderBy(asc(groupMember.joinedAt), sql`${groupMember}.rowid`)
    .all()
}

// Every user keeps at least one group: the earliest joined, or a new personal one.
export function defaultGroup(userId: string) {
  const [first] = listGroups(userId)
  if (first) return first
  const owner = db.select({ name: user.name }).from(user).where(eq(user.id, userId)).get()
  if (!owner) throw new Error(`Unknown user ${userId}`)
  createGroup(userId, personalGroupName(owner.name))
  return listGroups(userId)[0]
}

export function getGroup(groupId: string) {
  return db.select().from(group).where(eq(group.id, groupId)).get()
}

export function listMembers(groupId: string) {
  return db
    .select({
      userId: groupMember.userId,
      name: user.name,
      email: user.email,
      role: groupMember.role,
      joinedAt: groupMember.joinedAt,
    })
    .from(groupMember)
    .innerJoin(user, eq(user.id, groupMember.userId))
    .where(eq(groupMember.groupId, groupId))
    .orderBy(asc(groupMember.joinedAt), sql`${groupMember}.rowid`)
    .all()
}

function roleIn(userId: string, groupId: string) {
  return db
    .select({ role: groupMember.role })
    .from(groupMember)
    .where(and(eq(groupMember.userId, userId), eq(groupMember.groupId, groupId)))
    .get()?.role
}

export function isMember(userId: string, groupId: string) {
  return roleIn(userId, groupId) !== undefined
}

export function isAdmin(userId: string, groupId: string) {
  return roleIn(userId, groupId) === 'admin'
}

export function renameGroup(userId: string, groupId: string, name: string) {
  if (!isAdmin(userId, groupId)) return { error: ADMIN_ONLY }
  db.update(group).set({ name }).where(eq(group.id, groupId)).run()
  return {}
}

export function leaveGroup(userId: string, groupId: string) {
  const role = roleIn(userId, groupId)
  if (!role) return { error: 'Group not found' }
  const members = listMembers(groupId)
  if (members.length === 1) {
    db.delete(group).where(eq(group.id, groupId)).run()
    return {}
  }
  if (role === 'admin' && members.filter((m) => m.role === 'admin').length === 1) {
    return { error: 'You’re the only admin. Remove the other members before leaving.' }
  }
  db.delete(groupMember)
    .where(and(eq(groupMember.userId, userId), eq(groupMember.groupId, groupId)))
    .run()
  return {}
}

export function removeMember(adminId: string, groupId: string, userId: string) {
  if (!isAdmin(adminId, groupId)) return { error: ADMIN_ONLY }
  if (adminId === userId) return { error: 'Use Leave to remove yourself' }
  const { changes } = db
    .delete(groupMember)
    .where(and(eq(groupMember.userId, userId), eq(groupMember.groupId, groupId)))
    .run()
  return changes ? {} : { error: 'Member not found' }
}

export function createInvite(groupId: string, userId: string) {
  if (!isAdmin(userId, groupId)) return { error: ADMIN_ONLY }
  const token = randomBytes(24).toString('base64url')
  const created = db
    .insert(groupInvite)
    .values({
      groupId,
      createdById: userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    })
    .returning({ id: groupInvite.id, expiresAt: groupInvite.expiresAt })
    .get()
  return { ...created, token }
}

export function listInvites(groupId: string) {
  return db
    .select({
      id: groupInvite.id,
      createdAt: groupInvite.createdAt,
      expiresAt: groupInvite.expiresAt,
      createdBy: user.name,
    })
    .from(groupInvite)
    .innerJoin(user, eq(user.id, groupInvite.createdById))
    .where(
      and(
        eq(groupInvite.groupId, groupId),
        isNull(groupInvite.revokedAt),
        gt(groupInvite.expiresAt, new Date())
      )
    )
    .orderBy(asc(groupInvite.createdAt))
    .all()
}

export function revokeInvite(userId: string, inviteId: string) {
  const invite = db
    .select({ groupId: groupInvite.groupId })
    .from(groupInvite)
    .where(eq(groupInvite.id, inviteId))
    .get()
  if (!invite || !isMember(userId, invite.groupId)) return { error: 'Invite not found' }
  if (!isAdmin(userId, invite.groupId)) return { error: ADMIN_ONLY }
  db.update(groupInvite).set({ revokedAt: new Date() }).where(eq(groupInvite.id, inviteId)).run()
  return {}
}

export function getInviteGroup(token: string) {
  return db
    .select({ id: group.id, name: group.name })
    .from(groupInvite)
    .innerJoin(group, eq(group.id, groupInvite.groupId))
    .where(
      and(
        eq(groupInvite.tokenHash, hashToken(token)),
        isNull(groupInvite.revokedAt),
        gt(groupInvite.expiresAt, new Date())
      )
    )
    .get()
}

export function acceptInvite(token: string, userId: string) {
  const found = getInviteGroup(token)
  if (!found) return { error: INVALID_INVITE }
  db.insert(groupMember)
    .values({ groupId: found.id, userId, role: 'member' })
    .onConflictDoNothing()
    .run()
  return { group: found }
}
