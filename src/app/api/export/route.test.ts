import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getSession } from '@/lib/session'
import type { ExportDoc } from '@/lib/validation/transfer'
import { pngBuffer, sessionFor, setupTestDb } from '@/test/db'

vi.mock('@/lib/session', () => ({ getSession: vi.fn() }))

const { db, schema, insertUser, insertRecipe } = await setupTestDb()
const { saveImage } = await import('@/lib/images')
const { GET } = await import('./route')

const user = insertUser()
const cover = await saveImage(await pngBuffer())
const porridge = db
  .insert(schema.recipe)
  .values({ title: 'Porridge', coverImageId: cover.id, createdById: user.id })
  .returning()
  .get()
db.insert(schema.recipe).values({ title: 'Toast', createdById: user.id }).run()
const othersRecipe = insertRecipe(insertUser().id, { title: 'Not mine' })

beforeEach(() => {
  vi.mocked(getSession).mockResolvedValue(sessionFor(user))
})

function get(query = '') {
  return GET(new NextRequest(`http://localhost/api/export${query}`))
}

async function body(query = ''): Promise<ExportDoc> {
  return (await get(query)).json()
}

describe('GET /api/export', () => {
  it('returns the user’s recipes as a version 1 export', async () => {
    const doc = await body()
    expect(doc.version).toBe(1)
    expect(doc.recipes.map((r) => r.title)).toEqual(['Porridge', 'Toast'])
  })

  it('serves the export as a dated JSON download', async () => {
    const res = await get()
    const date = new Date().toISOString().slice(0, 10)
    expect(res.headers.get('content-type')).toBe('application/json')
    expect(res.headers.get('content-disposition')).toBe(
      `attachment; filename="recipes-${date}.json"`
    )
  })

  it('leaves images out by default', async () => {
    expect((await body()).images).toBeUndefined()
  })

  it('includes images when images=1', async () => {
    const doc = await body('?images=1')
    expect(doc.images?.map((img) => img.id)).toEqual([cover.id])
  })

  it('exports a single recipe when one is requested', async () => {
    const doc = await body(`?recipe=${porridge.id}`)
    expect(doc.recipes.map((r) => r.title)).toEqual(['Porridge'])
  })

  it('returns 404 for another user’s recipe', async () => {
    expect((await get(`?recipe=${othersRecipe.id}`)).status).toBe(404)
  })

  it('returns 404 for an unknown recipe', async () => {
    expect((await get('?recipe=missing')).status).toBe(404)
  })

  it('returns 401 without a session', async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    expect((await get()).status).toBe(401)
  })
})
