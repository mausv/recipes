import { describe, expect, it } from 'vitest'
import { setupTestDb } from '@/test/db'

const { db, schema, insertUser, insertIngredient } = await setupTestDb()
const { getIngredient, groupByCategory, listIngredientCategories, listIngredients } =
  await import('./ingredients')

const user = insertUser()
const oats = insertIngredient(user.id, { name: 'Rolled oats', brand: 'Quaker', category: 'Grains' })
const butter = insertIngredient(user.id, { name: 'Butter', brand: 'Kerrygold', category: 'Dairy' })
insertIngredient(user.id, { name: 'Ghee', brand: null, category: 'Dairy' })
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
    expect(names()).toEqual(['Butter', 'Ghee', 'Peanut butter', 'Rolled oats'])
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

describe('listIngredientCategories', () => {
  it('lists each category once, sorted, without uncategorized ingredients', () => {
    expect(listIngredientCategories()).toEqual(['Dairy', 'Grains'])
  })
})

describe('groupByCategory', () => {
  it('groups ingredients under sorted categories with uncategorized ones last', () => {
    const grouped = groupByCategory(listIngredients()).map(([category, items]) => [
      category,
      items.map((i) => i.name),
    ])
    expect(grouped).toEqual([
      ['Dairy', ['Butter', 'Ghee']],
      ['Grains', ['Rolled oats']],
      [null, ['Peanut butter']],
    ])
  })

  it('returns no groups for no ingredients', () => {
    expect(groupByCategory([])).toEqual([])
  })
})
