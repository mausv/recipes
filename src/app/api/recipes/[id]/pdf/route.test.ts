import fs from 'node:fs'
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getSession } from '@/lib/session'
import { pngBuffer, sessionFor, setupTestDb } from '@/test/db'

vi.mock('@/lib/session', () => ({ getSession: vi.fn() }))

const jar = vi.hoisted(() => new Map<string, string>())
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
  }),
  headers: async () => ({ get: () => null }),
}))

const { db, schema, insertUser, insertIngredient, insertGroup, insertRecipe, shareInto } =
  await setupTestDb()
const { imagePath, saveImage } = await import('@/lib/images')
const { GET } = await import('./route')

const user = insertUser()
const oats = insertIngredient(user.id, { name: 'Oats' })
const cover = await saveImage(await pngBuffer(400, 300))
const stepPhoto = await saveImage(await pngBuffer(200, 200))
const recipe = insertRecipe(user.id, {
  title: 'Crème brûlée: "the best"',
  description: 'Silky custard',
  servings: 2,
  tags: ['dessert'],
  coverImageId: cover.id,
})
db.insert(schema.recipeIngredient)
  .values([
    {
      recipeId: recipe.id,
      ingredientId: oats.id,
      quantity: 100,
      unit: 'g',
      grams: 100,
      position: 0,
    },
    {
      recipeId: recipe.id,
      ingredientId: oats.id,
      quantity: 1,
      unit: 'cup',
      grams: 90,
      groupName: 'Topping',
      position: 1,
    },
  ])
  .run()
db.insert(schema.recipeStep)
  .values([
    { recipeId: recipe.id, text: 'Whisk.', position: 0 },
    { recipeId: recipe.id, text: 'Bake.', imageId: stepPhoto.id, position: 1 },
  ])
  .run()

beforeEach(() => {
  jar.clear()
  vi.mocked(getSession).mockResolvedValue(sessionFor(user))
})

function get(id: string, query = '') {
  return GET(new NextRequest(`http://localhost/api/recipes/${id}/pdf${query}`), {
    params: Promise.resolve({ id }),
  })
}

async function bytes(res: Response) {
  return Buffer.from(await res.arrayBuffer())
}

describe('GET /api/recipes/[id]/pdf', () => {
  it('renders a PDF document', async () => {
    const res = await get(recipe.id)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
    const pdf = await bytes(res)
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
    expect(pdf.subarray(-6).toString()).toContain('%%EOF')
  })

  it('names the download after the recipe, keeping accents in filename*', async () => {
    expect((await get(recipe.id)).headers.get('content-disposition')).toBe(
      `attachment; filename="Creme brulee the best.pdf"; filename*=UTF-8''Cr%C3%A8me%20br%C3%BBl%C3%A9e%20the%20best.pdf`
    )
  })

  it('accepts servings and mode', async () => {
    const res = await get(recipe.id, '?servings=5&mode=split')
    expect(res.status).toBe(200)
    expect((await bytes(res)).subarray(0, 5).toString()).toBe('%PDF-')
  })

  it('renders in English by default and in Spanish with the locale cookie', async () => {
    expect((await bytes(await get(recipe.id))).toString('latin1')).toContain('/Lang (en)')
    jar.set('locale', 'es')
    expect((await bytes(await get(recipe.id))).toString('latin1')).toContain('/Lang (es)')
  })

  it('still renders when a photo file is missing', async () => {
    const photo = await saveImage(await pngBuffer())
    const bare = insertRecipe(user.id, { title: 'Toast', coverImageId: photo.id })
    fs.rmSync(imagePath(photo.id))
    const res = await get(bare.id)
    expect(res.status).toBe(200)
    expect((await bytes(res)).subarray(0, 5).toString()).toBe('%PDF-')
  })

  it('serves a recipe shared with the user', async () => {
    const owner = insertUser()
    const shared = insertRecipe(owner.id, { title: 'Shared' })
    shareInto(shared.id, insertGroup('Home', [owner.id, user.id]).id, owner.id)
    expect((await get(shared.id)).status).toBe(200)
  })

  it('falls back to an ASCII name when the title has no ASCII letters', async () => {
    const titled = insertRecipe(user.id, { title: '寿司' })
    expect((await get(titled.id)).headers.get('content-disposition')).toBe(
      `attachment; filename="recipe.pdf"; filename*=UTF-8''%E5%AF%BF%E5%8F%B8.pdf`
    )
  })

  it.each([
    '?servings=0',
    '?servings=-1',
    '?servings=2.5',
    '?servings=abc',
    '?servings=',
    '?servings=1000',
    '?mode=double',
  ])('returns 400 for %s', async (query) => {
    expect((await get(recipe.id, query)).status).toBe(400)
  })

  it('returns 404 for another user’s recipe', async () => {
    expect((await get(insertRecipe(insertUser().id).id)).status).toBe(404)
  })

  it('returns 404 for an unknown recipe', async () => {
    expect((await get('missing')).status).toBe(404)
  })

  it('returns 401 without a session', async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    expect((await get(recipe.id)).status).toBe(401)
  })
})
