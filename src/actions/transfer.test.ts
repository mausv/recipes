import { revalidatePath } from 'next/cache'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requireUser } from '@/lib/session'
import type { ExportDoc } from '@/lib/validation/transfer'
import { setupTestDb } from '@/test/db'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/session', () => ({ requireUser: vi.fn() }))

const { db, schema, insertUser } = await setupTestDb()
const { importRecipes } = await import('./transfer')

const user = insertUser()

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireUser).mockResolvedValue(user)
  db.delete(schema.recipe).run()
  db.delete(schema.ingredient).run()
})

function exportDoc(recipeLines: ExportDoc['recipes'][number]['ingredients'] = []): ExportDoc {
  return {
    version: 1,
    exportedAt: '2026-10-12T08:00:00.000Z',
    ingredients: [
      {
        id: 'oats',
        name: 'Oats',
        brand: null,
        kcal: 380,
        protein: 13,
        carbs: 60,
        fat: 7,
        fiber: null,
        density: 1,
        source: 'manual',
        sourceId: null,
        units: [],
      },
    ],
    recipes: [
      {
        id: 'porridge',
        title: 'Porridge',
        description: null,
        servings: 1,
        cookedWeightGrams: null,
        tags: [],
        coverImageId: null,
        ingredients: recipeLines,
        steps: [],
        comments: [],
        notes: [],
      },
    ],
  }
}

function form(content: string | null, mode: string | null = 'merge') {
  const data = new FormData()
  if (content !== null) {
    data.set('file', new File([content], 'export.json', { type: 'application/json' }))
  }
  if (mode !== null) data.set('mode', mode)
  return data
}

function titles() {
  return db
    .select({ title: schema.recipe.title })
    .from(schema.recipe)
    .all()
    .map((r) => r.title)
}

describe('importRecipes', () => {
  it('imports the file and returns the counts', async () => {
    expect(await importRecipes(form(JSON.stringify(exportDoc())))).toEqual({
      ingredients: 1,
      recipes: 1,
      images: 0,
    })
    expect(titles()).toEqual(['Porridge'])
  })

  it('records the signed-in user as the creator', async () => {
    await importRecipes(form(JSON.stringify(exportDoc())))
    expect(db.select().from(schema.recipe).get()?.createdById).toBe(user.id)
  })

  it('keeps existing recipes in merge mode', async () => {
    db.insert(schema.recipe).values({ title: 'Toast', createdById: user.id }).run()
    await importRecipes(form(JSON.stringify(exportDoc()), 'merge'))
    expect(titles().sort()).toEqual(['Porridge', 'Toast'])
  })

  it('removes existing recipes in replace mode', async () => {
    db.insert(schema.recipe).values({ title: 'Toast', createdById: user.id }).run()
    await importRecipes(form(JSON.stringify(exportDoc()), 'replace'))
    expect(titles()).toEqual(['Porridge'])
  })

  it('revalidates every page', async () => {
    await importRecipes(form(JSON.stringify(exportDoc())))
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout')
  })

  it('rejects a form without a file', async () => {
    expect(await importRecipes(form(null))).toEqual({ error: 'Choose an export file' })
  })

  it('rejects an empty file', async () => {
    expect(await importRecipes(form(''))).toEqual({ error: 'Choose an export file' })
  })

  it('rejects an unknown mode', async () => {
    expect(await importRecipes(form(JSON.stringify(exportDoc()), 'append'))).toEqual({
      error: 'Choose merge or replace',
    })
  })

  it('rejects a form without a mode', async () => {
    expect(await importRecipes(form(JSON.stringify(exportDoc()), null))).toEqual({
      error: 'Choose merge or replace',
    })
  })

  it('rejects a file that is not JSON', async () => {
    expect(await importRecipes(form('{ nope'))).toEqual({ error: 'The file is not valid JSON' })
  })

  it('rejects an unsupported export version', async () => {
    const content = JSON.stringify({ ...exportDoc(), version: 2 })
    expect(await importRecipes(form(content))).toEqual({
      error: 'Unsupported export version, expected version 1',
    })
  })

  it('returns the reason an import could not be applied', async () => {
    const lines = [
      { ingredientId: 'caviar', quantity: 1, unit: 'g', grams: 1, groupName: null, position: 0 },
    ]
    expect(await importRecipes(form(JSON.stringify(exportDoc(lines))))).toEqual({
      error: '"Porridge" uses an ingredient missing from the file',
    })
    expect(titles()).toEqual([])
  })

  it('does not revalidate when nothing was imported', async () => {
    await importRecipes(form('{ nope'))
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('refuses to run without a signed-in user', async () => {
    vi.mocked(requireUser).mockRejectedValue(new Error('NEXT_REDIRECT'))
    await expect(importRecipes(form(JSON.stringify(exportDoc())))).rejects.toThrow()
    expect(titles()).toEqual([])
  })
})
