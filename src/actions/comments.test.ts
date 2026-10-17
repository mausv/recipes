import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requireUser } from '@/lib/session'
import { setupTestDb } from '@/test/db'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/session', () => ({ requireUser: vi.fn() }))

const { db, schema, insertUser } = await setupTestDb()
const { addComment, deleteComment } = await import('./comments')

const ana = insertUser()
const ben = insertUser()
const porridge = db
  .insert(schema.recipe)
  .values({ title: 'Porridge', createdById: ana.id })
  .returning()
  .get()

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireUser).mockResolvedValue(ana)
})

function findComment(id: string) {
  return db.select().from(schema.recipeComment).where(eq(schema.recipeComment.id, id)).get()
}

async function posted(text = 'Delicious') {
  const result = await addComment({ recipeId: porridge.id, text })
  if (result.error !== undefined) throw new Error(result.error)
  return result.id
}

describe('addComment', () => {
  it('stores the trimmed comment on the recipe', async () => {
    const id = await posted('  Delicious  ')
    expect(findComment(id)).toMatchObject({ recipeId: porridge.id, text: 'Delicious' })
  })

  it('records the signed-in user as the author', async () => {
    vi.mocked(requireUser).mockResolvedValue(ben)
    expect(findComment(await posted())?.userId).toBe(ben.id)
  })

  it('rejects an empty comment', async () => {
    expect(await addComment({ recipeId: porridge.id, text: '  ' })).toEqual({
      error: 'Comment cannot be empty',
    })
  })

  it('rejects a comment on an unknown recipe', async () => {
    expect(await addComment({ recipeId: 'missing', text: 'Hi' })).toEqual({
      error: 'Recipe not found',
    })
  })

  it('revalidates the recipe page', async () => {
    await posted()
    expect(revalidatePath).toHaveBeenCalledWith(`/recipes/${porridge.id}`)
  })

  it('refuses to run without a signed-in user', async () => {
    vi.mocked(requireUser).mockRejectedValue(new Error('NEXT_REDIRECT'))
    const before = db.select().from(schema.recipeComment).all().length
    await expect(addComment({ recipeId: porridge.id, text: 'Hi' })).rejects.toThrow()
    expect(db.select().from(schema.recipeComment).all()).toHaveLength(before)
  })
})

describe('deleteComment', () => {
  it('lets the author delete their comment', async () => {
    const id = await posted()
    expect(await deleteComment(id)).toEqual({})
    expect(findComment(id)).toBeUndefined()
  })

  it('refuses to delete someone else’s comment', async () => {
    const id = await posted()
    vi.mocked(requireUser).mockResolvedValue(ben)
    expect(await deleteComment(id)).toEqual({ error: 'You can only delete your own comments' })
    expect(findComment(id)).toBeDefined()
  })

  it('returns an error for an unknown comment', async () => {
    expect(await deleteComment('missing')).toEqual({ error: 'Comment not found' })
  })

  it('revalidates the recipe page', async () => {
    const id = await posted()
    vi.clearAllMocks()
    await deleteComment(id)
    expect(revalidatePath).toHaveBeenCalledWith(`/recipes/${porridge.id}`)
  })

  it('refuses to run without a signed-in user', async () => {
    const id = await posted()
    vi.mocked(requireUser).mockRejectedValue(new Error('NEXT_REDIRECT'))
    await expect(deleteComment(id)).rejects.toThrow()
    expect(findComment(id)).toBeDefined()
  })
})
