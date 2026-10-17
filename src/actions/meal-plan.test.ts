import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requireUser } from '@/lib/session'
import { setupTestDb } from '@/test/db'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/session', () => ({ requireUser: vi.fn() }))

const jar = vi.hoisted(() => new Map<string, string>())
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
  }),
}))

const { db, schema, insertUser, insertGroup, insertRecipe } = await setupTestDb()
const { addPlanEntry, movePlanEntry, removePlanEntry, updatePlanEntry } =
  await import('./meal-plan')

const user = insertUser()
const home = insertGroup('Home', [user.id])
const cabin = insertGroup('Cabin', [user.id])
const porridge = insertRecipe(user.id)
const WEDNESDAY = '2026-10-14'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireUser).mockResolvedValue(user)
  jar.clear()
  db.delete(schema.mealPlanEntry).run()
})

function entries() {
  return db
    .select({
      id: schema.mealPlanEntry.id,
      groupId: schema.mealPlanEntry.groupId,
      date: schema.mealPlanEntry.date,
      slot: schema.mealPlanEntry.slot,
      servings: schema.mealPlanEntry.servings,
      note: schema.mealPlanEntry.note,
    })
    .from(schema.mealPlanEntry)
    .all()
}

function insertEntry(values: Partial<typeof schema.mealPlanEntry.$inferInsert> = {}) {
  return db
    .insert(schema.mealPlanEntry)
    .values({
      groupId: home.id,
      date: WEDNESDAY,
      slot: 'dinner',
      recipeId: porridge.id,
      position: 0,
      createdById: user.id,
      ...values,
    })
    .returning()
    .get()
}

describe('addPlanEntry', () => {
  it('adds the entry to the user’s earliest group without a cookie', async () => {
    await addPlanEntry({ date: WEDNESDAY, slot: 'dinner', recipeId: porridge.id })
    expect(entries()).toMatchObject([{ groupId: home.id, date: WEDNESDAY, slot: 'dinner' }])
  })

  it('adds the entry to the group chosen in the cookie', async () => {
    jar.set('group', cabin.id)
    await addPlanEntry({ date: WEDNESDAY, slot: 'lunch', note: 'Out' })
    expect(entries()).toMatchObject([{ groupId: cabin.id, note: 'Out' }])
  })

  it('returns the new entry id', async () => {
    const result = await addPlanEntry({ date: WEDNESDAY, slot: 'lunch', note: 'Out' })
    expect(result).toEqual({ id: entries()[0].id })
  })

  it('returns the validation message for an invalid date', async () => {
    expect(await addPlanEntry({ date: '2026-02-30', slot: 'lunch', note: 'Out' })).toEqual({
      error: 'Pick a valid date',
    })
  })

  it('returns an error for a recipe the user cannot view', async () => {
    const hidden = insertRecipe(insertUser().id)
    expect(await addPlanEntry({ date: WEDNESDAY, slot: 'dinner', recipeId: hidden.id })).toEqual({
      error: 'Recipe not found',
    })
    expect(entries()).toEqual([])
  })

  it('revalidates the plan page', async () => {
    await addPlanEntry({ date: WEDNESDAY, slot: 'lunch', note: 'Out' })
    expect(revalidatePath).toHaveBeenCalledWith('/plan')
  })

  it('does not revalidate when refused', async () => {
    await addPlanEntry({ date: WEDNESDAY, slot: 'lunch' })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('refuses to run without a signed-in user', async () => {
    vi.mocked(requireUser).mockRejectedValue(new Error('NEXT_REDIRECT'))
    await expect(addPlanEntry({ date: WEDNESDAY, slot: 'lunch', note: 'Out' })).rejects.toThrow()
    expect(entries()).toEqual([])
  })
})

describe('updatePlanEntry', () => {
  it('changes the servings', async () => {
    const entry = insertEntry()
    expect(await updatePlanEntry(entry.id, { servings: 3 })).toEqual({})
    expect(entries()[0].servings).toBe(3)
  })

  it('returns the validation message for zero servings', async () => {
    expect(await updatePlanEntry(insertEntry().id, { servings: 0 })).toEqual({
      error: 'Servings must be > 0',
    })
  })

  it('returns an error for an entry outside the active group', async () => {
    const entry = insertEntry()
    jar.set('group', cabin.id)
    expect(await updatePlanEntry(entry.id, { servings: 3 })).toEqual({ error: 'Entry not found' })
  })
})

describe('movePlanEntry', () => {
  it('moves the entry', async () => {
    const entry = insertEntry()
    expect(await movePlanEntry(entry.id, { date: '2026-10-16', slot: 'lunch' })).toEqual({})
    expect(entries()[0]).toMatchObject({ date: '2026-10-16', slot: 'lunch' })
  })

  it('returns an error for an entry outside the active group', async () => {
    const entry = insertEntry()
    jar.set('group', cabin.id)
    expect(await movePlanEntry(entry.id, { date: '2026-10-16', slot: 'lunch' })).toEqual({
      error: 'Entry not found',
    })
  })
})

describe('removePlanEntry', () => {
  it('removes the entry', async () => {
    const entry = insertEntry()
    expect(await removePlanEntry(entry.id)).toEqual({})
    expect(entries()).toEqual([])
  })

  it('returns an error for an entry outside the active group', async () => {
    const entry = insertEntry()
    jar.set('group', cabin.id)
    expect(await removePlanEntry(entry.id)).toEqual({ error: 'Entry not found' })
    expect(
      db.select().from(schema.mealPlanEntry).where(eq(schema.mealPlanEntry.id, entry.id)).get()
    ).toBeDefined()
  })

  it('revalidates the plan page', async () => {
    await removePlanEntry(insertEntry().id)
    expect(revalidatePath).toHaveBeenCalledWith('/plan')
  })
})
