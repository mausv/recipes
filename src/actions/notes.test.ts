import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requireUser } from '@/lib/session'
import { setupTestDb } from '@/test/db'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/session', () => ({ requireUser: vi.fn() }))

const { db, schema, insertUser } = await setupTestDb()
const { saveNote } = await import('./notes')

const ana = insertUser()
const ben = insertUser()

function insertRecipe() {
  return db
    .insert(schema.recipe)
    .values({ title: 'Porridge', createdById: ana.id })
    .returning()
    .get().id
}

function notesOf(recipeId: string) {
  return db.select().from(schema.recipeNote).where(eq(schema.recipeNote.recipeId, recipeId)).all()
}

function noteText(recipeId: string, userId: string) {
  return db
    .select({ text: schema.recipeNote.text })
    .from(schema.recipeNote)
    .where(and(eq(schema.recipeNote.recipeId, recipeId), eq(schema.recipeNote.userId, userId)))
    .get()?.text
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireUser).mockResolvedValue(ana)
})

describe('saveNote', () => {
  it('creates the signed-in user’s note', async () => {
    const recipeId = insertRecipe()
    expect(await saveNote({ recipeId, text: 'Less salt' })).toEqual({})
    expect(noteText(recipeId, ana.id)).toBe('Less salt')
  })

  it('trims the text', async () => {
    const recipeId = insertRecipe()
    await saveNote({ recipeId, text: '  Less salt \n' })
    expect(noteText(recipeId, ana.id)).toBe('Less salt')
  })

  it('updates the existing note instead of adding another', async () => {
    const recipeId = insertRecipe()
    await saveNote({ recipeId, text: 'Less salt' })
    await saveNote({ recipeId, text: 'No salt' })
    expect(notesOf(recipeId).map((n) => n.text)).toEqual(['No salt'])
  })

  it('bumps the updated time when the note changes', async () => {
    const recipeId = insertRecipe()
    await saveNote({ recipeId, text: 'Less salt' })
    db.update(schema.recipeNote)
      .set({ updatedAt: new Date(0) })
      .run()
    await saveNote({ recipeId, text: 'No salt' })
    expect(notesOf(recipeId)[0].updatedAt.getTime()).toBeGreaterThan(0)
  })

  it('keeps each user’s note separate', async () => {
    const recipeId = insertRecipe()
    await saveNote({ recipeId, text: 'Less salt' })
    vi.mocked(requireUser).mockResolvedValue(ben)
    await saveNote({ recipeId, text: 'More salt' })
    expect(noteText(recipeId, ana.id)).toBe('Less salt')
    expect(noteText(recipeId, ben.id)).toBe('More salt')
  })

  it('deletes the note when the text is empty', async () => {
    const recipeId = insertRecipe()
    await saveNote({ recipeId, text: 'Less salt' })
    await saveNote({ recipeId, text: '   ' })
    expect(notesOf(recipeId)).toEqual([])
  })

  it('leaves other users’ notes alone when deleting', async () => {
    const recipeId = insertRecipe()
    vi.mocked(requireUser).mockResolvedValue(ben)
    await saveNote({ recipeId, text: 'More salt' })
    vi.mocked(requireUser).mockResolvedValue(ana)
    await saveNote({ recipeId, text: '' })
    expect(noteText(recipeId, ben.id)).toBe('More salt')
  })

  it('accepts an empty note when none exists yet', async () => {
    const recipeId = insertRecipe()
    expect(await saveNote({ recipeId, text: '' })).toEqual({})
    expect(notesOf(recipeId)).toEqual([])
  })

  it('rejects a note on an unknown recipe', async () => {
    expect(await saveNote({ recipeId: 'missing', text: 'Hi' })).toEqual({
      error: 'Recipe not found',
    })
  })

  it('revalidates the recipe page', async () => {
    const recipeId = insertRecipe()
    await saveNote({ recipeId, text: 'Less salt' })
    expect(revalidatePath).toHaveBeenCalledWith(`/recipes/${recipeId}`)
  })

  it('refuses to run without a signed-in user', async () => {
    const recipeId = insertRecipe()
    vi.mocked(requireUser).mockRejectedValue(new Error('NEXT_REDIRECT'))
    await expect(saveNote({ recipeId, text: 'Less salt' })).rejects.toThrow()
    expect(notesOf(recipeId)).toEqual([])
  })
})
