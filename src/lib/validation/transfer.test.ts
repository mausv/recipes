import { describe, expect, it } from 'vitest'
import { type ExportDoc, exportSchema, importModeSchema } from './transfer'

const recipe: ExportDoc['recipes'][number] = {
  id: 'r1',
  title: 'Porridge',
  description: null,
  servings: 2,
  cookedWeightGrams: null,
  tags: [],
  coverImageId: null,
  ingredients: [
    { ingredientId: 'i1', quantity: 80, unit: 'g', grams: 80, groupName: null, position: 0 },
  ],
  steps: [{ text: 'Simmer', imageId: null, position: 0 }],
  comments: [{ authorName: 'Ana', text: 'Nice', createdAt: '2026-01-02T03:04:05.678Z' }],
  notes: [{ authorName: 'Ana', text: 'Less salt', updatedAt: '2026-01-02T03:04:05.678Z' }],
}

const doc: ExportDoc = {
  version: 1,
  exportedAt: '2026-10-12T08:00:00.000Z',
  ingredients: [
    {
      id: 'i1',
      name: 'Oats',
      brand: null,
      category: 'Grains',
      kcal: 380,
      protein: 13,
      carbs: 60,
      fat: 7,
      fiber: null,
      density: 1,
      source: 'manual',
      sourceId: null,
      units: [{ name: 'cup', grams: 90 }],
    },
  ],
  recipes: [recipe],
}

const imageId = '0b7c1a9e-3f7d-4c55-9a1e-2d8f6b4c3a21'

function firstError(input: unknown) {
  return exportSchema.safeParse(input).error?.issues[0].message
}

describe('exportSchema', () => {
  it('accepts a document without images', () => {
    expect(exportSchema.safeParse(doc).success).toBe(true)
  })

  it('accepts a document with base64 images', () => {
    const images = [{ id: imageId, width: 10, height: 10, data: 'UklGRg==' }]
    expect(exportSchema.safeParse({ ...doc, images }).success).toBe(true)
  })

  it('defaults a missing ingredient category to null for older exports', () => {
    const legacy = { ...doc.ingredients[0], category: undefined }
    const parsed = exportSchema.parse({ ...doc, ingredients: [legacy] })
    expect(parsed.ingredients[0].category).toBeNull()
  })

  it('rejects another version with a clear message', () => {
    expect(firstError({ ...doc, version: 2 })).toBe(
      'Unsupported export version, expected version 1'
    )
  })

  it('rejects a document without a version', () => {
    expect(firstError({ ...doc, version: undefined })).toBe(
      'Unsupported export version, expected version 1'
    )
  })

  it('rejects an invalid export date', () => {
    expect(exportSchema.safeParse({ ...doc, exportedAt: 'yesterday' }).success).toBe(false)
  })

  it('normalises recipe tags', () => {
    const parsed = exportSchema.parse({
      ...doc,
      recipes: [{ ...recipe, tags: [' Quick', 'quick'] }],
    })
    expect(parsed.recipes[0].tags).toEqual(['quick'])
  })

  it('rejects an image id that is not a UUID', () => {
    const images = [{ id: '../recipes.db', width: 10, height: 10, data: 'UklGRg==' }]
    expect(firstError({ ...doc, images })).toBe('Invalid image id')
  })

  it('rejects a cover image id that is not a UUID', () => {
    const recipes = [{ ...recipe, coverImageId: '../../etc/passwd' }]
    expect(firstError({ ...doc, recipes })).toBe('Invalid image id')
  })

  it('rejects image data that is not base64', () => {
    const images = [{ id: imageId, width: 10, height: 10, data: 'not base64!' }]
    expect(exportSchema.safeParse({ ...doc, images }).success).toBe(false)
  })

  it('rejects an unknown ingredient source', () => {
    const ingredients = [{ ...doc.ingredients[0], source: 'web' }]
    expect(exportSchema.safeParse({ ...doc, ingredients }).success).toBe(false)
  })

  it('rejects a comment with an invalid date', () => {
    const comments = [{ authorName: 'Ana', text: 'Nice', createdAt: 'today' }]
    const recipes = [{ ...recipe, comments }]
    expect(exportSchema.safeParse({ ...doc, recipes }).success).toBe(false)
  })
})

describe('importModeSchema', () => {
  it.each(['merge', 'replace'])('accepts %s', (mode) => {
    expect(importModeSchema.parse(mode)).toBe(mode)
  })

  it('rejects any other mode', () => {
    expect(importModeSchema.safeParse('append').error?.issues[0].message).toBe(
      'Choose merge or replace'
    )
  })
})
