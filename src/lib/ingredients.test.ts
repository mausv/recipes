import { describe, expect, it } from 'vitest'
import { setupTestDb } from '@/test/db'

const { db, schema, insertUser, insertIngredient } = await setupTestDb()
const { getIngredient, listIngredients } = await import('./ingredients')

const user = insertUser()
const oats = insertIngredient(user.id, { name: 'Rolled oats', brand: 'Quaker' })
const butter = insertIngredient(user.id, { name: 'Butter', brand: 'Kerrygold' })
insertIngredient(user.id, { name: 'Peanut butter', brand: null })
db.insert(schema.ingredientUnit)
  .values([
    { ingredientId: oats.id, name: 'tbsp', grams: 8 },
    { ingredientId: oats.id, name: 'cup', grams: 90 },
  ])
  .run()

function names(q?: string) {
  return listIngredients(q).map((i) => i.name)
}

describe('listIngredients', () => {
  it('lists every ingredient sorted by name without a query', () => {
    expect(names()).toEqual(['Butter', 'Peanut butter', 'Rolled oats'])
  })

  it('matches the query against the name, case-insensitively', () => {
    expect(names('BUTTER')).toEqual(['Butter', 'Peanut butter'])
  })

  it('matches the query against the brand', () => {
    expect(names('quaker')).toEqual(['Rolled oats'])
  })

  it('returns nothing when no ingredient matches', () => {
    expect(names('caviar')).toEqual([])
  })

  it('treats % in the query as a literal character', () => {
    expect(names('%')).toEqual([])
  })

  it('includes custom units sorted by name', () => {
    const [rolledOats] = listIngredients('oats')
    expect(rolledOats.units).toEqual([
      { name: 'cup', grams: 90 },
      { name: 'tbsp', grams: 8 },
    ])
  })
})

describe('getIngredient', () => {
  it('returns the ingredient with its units', () => {
    expect(getIngredient(oats.id)).toMatchObject({ name: 'Rolled oats', units: expect.any(Array) })
  })

  it('returns undefined for an unknown id', () => {
    expect(getIngredient('missing')).toBeUndefined()
  })

  it('returns an ingredient without units with an empty list', () => {
    expect(getIngredient(butter.id)?.units).toEqual([])
  })
})
