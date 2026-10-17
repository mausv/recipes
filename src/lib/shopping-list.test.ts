import { beforeEach, describe, expect, it } from 'vitest'
import { setupTestDb } from '@/test/db'

const { db, schema, insertUser, insertIngredient, insertGroup, insertRecipe, shareInto } =
  await setupTestDb()
const {
  addRecipeToShoppingList,
  addShoppingItem,
  addWeekToShoppingList,
  clearShoppingList,
  getShoppingList,
  moveBoughtToPantry,
  setPantryItem,
  setShoppingItemsChecked,
} = await import('./shopping-list')

const user = insertUser()
const home = insertGroup('Home', [user.id])
const cabin = insertGroup('Cabin', [user.id])
const oats = insertIngredient(user.id)
const milk = insertIngredient(user.id, { name: 'Milk' })
const porridge = insertRecipe(user.id)

beforeEach(() => {
  db.delete(schema.shoppingItem).run()
  db.delete(schema.pantryItem).run()
})

describe('getShoppingList', () => {
  it('merges needs per ingredient and applies the pantry', () => {
    db.insert(schema.shoppingItem)
      .values([
        { groupId: home.id, ingredientId: oats.id, name: 'Oats', grams: 80, recipeId: porridge.id },
        { groupId: home.id, ingredientId: oats.id, name: 'Oats', grams: 40 },
      ])
      .run()
    db.insert(schema.pantryItem)
      .values({ groupId: home.id, ingredientId: oats.id, grams: 50 })
      .run()

    const { needs } = getShoppingList(home.id)
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
    db.insert(schema.shoppingItem).values({ groupId: home.id, name: 'Soap' }).run()
    expect(getShoppingList(home.id)).toMatchObject({ needs: [], freeText: [{ name: 'Soap' }] })
  })

  it('returns the pantry sorted by ingredient name', () => {
    db.insert(schema.pantryItem)
      .values([
        { groupId: home.id, ingredientId: oats.id, grams: 10 },
        { groupId: home.id, ingredientId: milk.id, grams: null },
      ])
      .run()
    expect(getShoppingList(home.id).pantry).toEqual([
      { ingredientId: milk.id, grams: null, name: 'Milk', brand: null },
      { ingredientId: oats.id, grams: 10, name: 'Oats', brand: null },
    ])
  })
})

describe('addShoppingItem', () => {
  it('returns the new item id', () => {
    const result = addShoppingItem(home.id, {
      name: 'Soap',
      quantity: null,
      unit: null,
      ingredientId: null,
    })
    expect(result).toEqual({ id: getShoppingList(home.id).freeText[0].id })
  })

  it('resolves grams for a linked ingredient measured in cups', () => {
    const flour = insertIngredient(user.id, { name: 'Flour', density: 0.5 })
    addShoppingItem(home.id, { name: 'Flour', quantity: 2, unit: 'cup', ingredientId: flour.id })
    expect(getShoppingList(home.id).needs).toMatchObject([
      { ingredientId: flour.id, neededGrams: 240 },
    ])
  })
})

describe('group scoping', () => {
  function soap(groupId: string) {
    return addShoppingItem(groupId, {
      name: 'Soap',
      quantity: null,
      unit: null,
      ingredientId: null,
    })
  }

  it('keeps each group’s shopping list separate', () => {
    soap(home.id)
    expect(getShoppingList(cabin.id).freeText).toEqual([])
  })

  it('keeps each group’s pantry separate', () => {
    setPantryItem(home.id, { ingredientId: oats.id, grams: 100 })
    setPantryItem(cabin.id, { ingredientId: oats.id, grams: 5 })
    expect(getShoppingList(home.id).pantry).toMatchObject([{ grams: 100 }])
    expect(getShoppingList(cabin.id).pantry).toMatchObject([{ grams: 5 }])
  })

  it('does not check items of another group', () => {
    const item = soap(home.id)
    if ('error' in item) throw new Error(item.error)
    setShoppingItemsChecked(cabin.id, [item.id], true)
    expect(getShoppingList(home.id).freeText[0].checked).toBe(false)
  })

  it('clears only the given group’s list', () => {
    soap(home.id)
    soap(cabin.id)
    clearShoppingList(cabin.id)
    expect(getShoppingList(home.id).freeText).toHaveLength(1)
  })

  it('moves bought items into the same group’s pantry', () => {
    db.insert(schema.shoppingItem)
      .values({ groupId: cabin.id, ingredientId: oats.id, name: 'Oats', grams: 30, checked: true })
      .run()
    moveBoughtToPantry(cabin.id)
    expect(getShoppingList(cabin.id).pantry).toMatchObject([{ ingredientId: oats.id, grams: 30 }])
    expect(getShoppingList(home.id).pantry).toEqual([])
  })
})

describe('addRecipeToShoppingList', () => {
  it('adds the lines of a recipe shared with the user', () => {
    const friend = insertUser()
    const shared = insertGroup('Shared', [friend.id, user.id])
    const recipe = insertRecipe(friend.id)
    db.insert(schema.recipeIngredient)
      .values({
        recipeId: recipe.id,
        ingredientId: oats.id,
        quantity: 1,
        unit: 'g',
        grams: 1,
        position: 0,
      })
      .run()
    shareInto(recipe.id, shared.id, friend.id)
    expect(addRecipeToShoppingList(home.id, user.id, recipe.id, 1)).toEqual({ added: 1 })
  })

  it('refuses a recipe the user cannot see', () => {
    const recipe = insertRecipe(insertUser().id)
    expect(addRecipeToShoppingList(home.id, user.id, recipe.id, 1)).toEqual({
      error: 'Recipe not found',
    })
  })
})

describe('addWeekToShoppingList', () => {
  const MONDAY = '2026-10-12'
  const stew = insertRecipe(user.id, { title: 'Stew', servings: 4 })
  db.insert(schema.recipeIngredient)
    .values({
      recipeId: stew.id,
      ingredientId: oats.id,
      quantity: 400,
      unit: 'g',
      grams: 400,
      position: 0,
    })
    .run()

  beforeEach(() => {
    db.delete(schema.mealPlanEntry).run()
  })

  function plan(values: Partial<typeof schema.mealPlanEntry.$inferInsert>) {
    db.insert(schema.mealPlanEntry)
      .values({
        groupId: home.id,
        date: MONDAY,
        slot: 'dinner',
        position: 0,
        createdById: user.id,
        ...values,
      })
      .run()
  }

  function grams() {
    return db
      .select({ grams: schema.shoppingItem.grams })
      .from(schema.shoppingItem)
      .all()
      .map((i) => i.grams)
  }

  it('scales each recipe to the entry servings', () => {
    plan({ recipeId: stew.id, servings: 2 })
    addWeekToShoppingList(home.id, user.id, MONDAY)
    expect(grams()).toEqual([200])
  })

  it('uses the recipe servings when the entry has none', () => {
    plan({ recipeId: stew.id })
    addWeekToShoppingList(home.id, user.id, MONDAY)
    expect(grams()).toEqual([400])
  })

  it('adds a recipe once per entry', () => {
    plan({ recipeId: stew.id, date: MONDAY })
    plan({ recipeId: stew.id, date: '2026-10-18' })
    expect(addWeekToShoppingList(home.id, user.id, MONDAY)).toEqual({ added: 2, skipped: 0 })
  })

  it('ignores notes and entries outside the week', () => {
    plan({ note: 'Eat out' })
    plan({ recipeId: stew.id, date: '2026-10-19' })
    plan({ recipeId: stew.id, date: '2026-10-11' })
    expect(addWeekToShoppingList(home.id, user.id, MONDAY)).toEqual({ added: 0, skipped: 0 })
  })

  it('ignores entries of another group', () => {
    plan({ recipeId: stew.id, groupId: cabin.id })
    expect(addWeekToShoppingList(home.id, user.id, MONDAY)).toEqual({ added: 0, skipped: 0 })
  })

  it('adds the lines to the given group', () => {
    plan({ recipeId: stew.id })
    addWeekToShoppingList(home.id, user.id, MONDAY)
    expect(getShoppingList(home.id).needs).toMatchObject([{ ingredientId: oats.id }])
  })

  it('skips recipes the user cannot view and counts them', () => {
    const hidden = insertRecipe(insertUser().id)
    plan({ recipeId: hidden.id })
    plan({ recipeId: stew.id })
    expect(addWeekToShoppingList(home.id, user.id, MONDAY)).toEqual({ added: 1, skipped: 1 })
    expect(grams()).toEqual([400])
  })
})
