import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { afterAll, vi } from 'vitest'
import type { user as userTable } from '@/db/schema'
import type { getSession } from '@/lib/session'

export async function setupTestDb() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'recipes-test-'))
  vi.stubEnv('DATA_DIR', dataDir)
  vi.stubEnv('BETTER_AUTH_URL', 'http://localhost:3000')
  vi.stubEnv('BETTER_AUTH_SECRET', 'test-secret-that-is-at-least-32-characters')
  afterAll(() => {
    vi.unstubAllEnvs()
    fs.rmSync(dataDir, { recursive: true, force: true })
  })

  const { db } = await import('@/db')
  const schema = await import('@/db/schema')

  function insertUser() {
    return db
      .insert(schema.user)
      .values({ id: crypto.randomUUID(), name: 'Ana', email: `${crypto.randomUUID()}@example.com` })
      .returning()
      .get()
  }

  function insertIngredient(
    createdById: string,
    values: Partial<typeof schema.ingredient.$inferInsert> = {}
  ) {
    return db
      .insert(schema.ingredient)
      .values({ name: 'Oats', kcal: 380, protein: 13, carbs: 60, fat: 7, createdById, ...values })
      .returning()
      .get()
  }

  function insertGroup(name: string, [adminId, ...memberIds]: string[]) {
    const created = db.insert(schema.group).values({ name, createdById: adminId }).returning().get()
    db.insert(schema.groupMember)
      .values([
        { groupId: created.id, userId: adminId, role: 'admin' as const },
        ...memberIds.map((userId) => ({ groupId: created.id, userId, role: 'member' as const })),
      ])
      .run()
    return created
  }

  function insertRecipe(
    createdById: string,
    values: Partial<typeof schema.recipe.$inferInsert> = {}
  ) {
    return db
      .insert(schema.recipe)
      .values({ title: 'Porridge', createdById, ...values })
      .returning()
      .get()
  }

  function shareInto(recipeId: string, groupId: string, sharedById: string) {
    db.insert(schema.recipeShare).values({ recipeId, groupId, sharedById }).run()
  }

  return {
    db,
    schema,
    dataDir,
    insertUser,
    insertIngredient,
    insertGroup,
    insertRecipe,
    shareInto,
  }
}

export type TestUser = typeof userTable.$inferSelect

export function sessionFor(user: TestUser): NonNullable<Awaited<ReturnType<typeof getSession>>> {
  return {
    user,
    session: {
      id: crypto.randomUUID(),
      token: crypto.randomUUID(),
      userId: user.id,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  }
}

export function pngBuffer(width = 40, height = 20) {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 80, b: 40 } },
  })
    .png()
    .toBuffer()
}
