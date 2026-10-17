import { beforeEach, describe, expect, it } from 'vitest'
import { setupTestDb } from '@/test/db'

const { db, schema, insertUser, insertIngredient } = await setupTestDb()
const { addShoppingItem, getShoppingList } = await import('./shopping-list')

const user = insertUser()
const oats = insertIngredient(user.id)
const milk = insertIngredient(user.id, { name: 'Milk' })
const porridge = db
  .insert(schema.recipe)
  .values({ title: 'Porridge', createdById: user.id })
  .returning()
  .get()

beforeEach(() => {
  db.delete(schema.shoppingItem).run()
  db.delete(schema.pantryItem).run()
})

describe('getShoppingList', () => {
  it('merges needs per ingredient and applies the pantry', () => {
    db.insert(schema.shoppingItem)
      .values([
        { ingredientId: oats.id, name: 'Oats', grams: 80, recipeId: porridge.id },
        { ingredientId: oats.id, name: 'Oats', grams: 40 },
      ])
      .run()
    db.insert(schema.pantryItem).values({ ingredientId: oats.id, grams: 50 }).run()

    const { needs } = getShoppingList()
    expect(needs).toMatchObject([
      {
        ingredientId: oats.id,
        neededGrams: 120,
        haveGrams: 50,
        toBuyGrams: 70,
        recipeIds: [porridge.id],
      },
    ])
    expect(needs[0].lines.flatMap((l) => (l.recipe ? [l.recipe.title] : []))).toEqual(['Porridge'])
  })

  it('returns free-text items separately', () => {
    db.insert(schema.shoppingItem).values({ name: 'Soap' }).run()
    expect(getShoppingList()).toMatchObject({ needs: [], freeText: [{ name: 'Soap' }] })
  })

  it('returns the pantry sorted by ingredient name', () => {
    db.insert(schema.pantryItem)
      .values([
        { ingredientId: oats.id, grams: 10 },
        { ingredientId: milk.id, grams: null },
      ])
      .run()
    expect(getShoppingList().pantry).toEqual([
      { ingredientId: milk.id, grams: null, name: 'Milk', brand: null },
      { ingredientId: oats.id, grams: 10, name: 'Oats', brand: null },
    ])
  })
})

describe('addShoppingItem', () => {
  it('returns the new item id', () => {
    const result = addShoppingItem({ name: 'Soap', quantity: null, unit: null, ingredientId: null })
    expect(result).toEqual({ id: getShoppingList().freeText[0].id })
  })

  it('resolves grams for a linked ingredient measured in cups', () => {
    const flour = insertIngredient(user.id, { name: 'Flour', density: 0.5 })
    addShoppingItem({ name: 'Flour', quantity: 2, unit: 'cup', ingredientId: flour.id })
    expect(getShoppingList().needs).toMatchObject([{ ingredientId: flour.id, neededGrams: 240 }])
  })
})
