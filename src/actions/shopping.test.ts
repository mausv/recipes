import { eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requireUser } from '@/lib/session'
import { setupTestDb } from '@/test/db'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/session', () => ({ requireUser: vi.fn() }))

const jar = vi.hoisted(() => new Map<string, string>())
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
  }),
}))

const { db, schema, insertUser, insertIngredient, insertGroup, insertRecipe } = await setupTestDb()
const {
  addRecipeToShoppingList,
  addShoppingItem,
  clearCheckedItems,
  clearShoppingList,
  markBoughtIntoPantry,
  removePantryItem,
  removeShoppingItems,
  setPantryItem,
  toggleShoppingItems,
} = await import('./shopping')

const user = insertUser()
const home = insertGroup('Home', [user.id])
const cabin = insertGroup('Cabin', [user.id])
const oats = insertIngredient(user.id, { density: 0.4 })
const egg = insertIngredient(user.id, { name: 'Egg', kcal: 143 })
const milk = insertIngredient(user.id, { name: 'Milk', kcal: 64 })
db.insert(schema.ingredientUnit).values({ ingredientId: egg.id, name: 'piece', grams: 50 }).run()

const porridge = db
  .insert(schema.recipe)
  .values({ title: 'Porridge', servings: 2, createdById: user.id })
  .returning()
  .get()
db.insert(schema.recipeIngredient)
  .values([
    {
      recipeId: porridge.id,
      ingredientId: oats.id,
      quantity: 80,
      unit: 'g',
      grams: 80,
      position: 0,
    },
    {
      recipeId: porridge.id,
      ingredientId: egg.id,
      quantity: 2,
      unit: 'piece',
      grams: 100,
      position: 1,
    },
  ])
  .run()

const emptyRecipe = db
  .insert(schema.recipe)
  .values({ title: 'Water', servings: 1, createdById: user.id })
  .returning()
  .get()

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireUser).mockResolvedValue(user)
  jar.clear()
  db.delete(schema.shoppingItem).run()
  db.delete(schema.pantryItem).run()
})

function items() {
  return db
    .select({
      id: schema.shoppingItem.id,
      ingredientId: schema.shoppingItem.ingredientId,
      name: schema.shoppingItem.name,
      grams: schema.shoppingItem.grams,
      quantity: schema.shoppingItem.quantity,
      unit: schema.shoppingItem.unit,
      recipeId: schema.shoppingItem.recipeId,
      checked: schema.shoppingItem.checked,
    })
    .from(schema.shoppingItem)
    .orderBy(sql`rowid`)
    .all()
}

function pantry() {
  return db
    .select({ ingredientId: schema.pantryItem.ingredientId, grams: schema.pantryItem.grams })
    .from(schema.pantryItem)
    .all()
}

function pantryGrams(ingredientId: string) {
  return db
    .select({ grams: schema.pantryItem.grams })
    .from(schema.pantryItem)
    .where(eq(schema.pantryItem.ingredientId, ingredientId))
    .get()?.grams
}

function insertItem(values: Partial<typeof schema.shoppingItem.$inferInsert> = {}) {
  return db
    .insert(schema.shoppingItem)
    .values({ groupId: home.id, name: 'Oats', ingredientId: oats.id, grams: 100, ...values })
    .returning()
    .get()
}

function insertPantry(ingredientId: string, grams: number | null) {
  db.insert(schema.pantryItem).values({ groupId: home.id, ingredientId, grams }).run()
}

describe('addRecipeToShoppingList', () => {
  it('adds one item per recipe ingredient line', async () => {
    await addRecipeToShoppingList({ recipeId: porridge.id, servings: 2 })
    expect(items().map((i) => i.ingredientId)).toEqual([oats.id, egg.id])
  })

  it('stores the ingredient name, amounts and source recipe at the recipe servings', async () => {
    await addRecipeToShoppingList({ recipeId: porridge.id, servings: 2 })
    expect(items()[1]).toMatchObject({
      ingredientId: egg.id,
      name: 'Egg',
      grams: 100,
      quantity: 2,
      unit: 'piece',
      recipeId: porridge.id,
      checked: false,
    })
  })

  it('scales the amounts to the requested servings', async () => {
    await addRecipeToShoppingList({ recipeId: porridge.id, servings: 3 })
    expect(items().map((i) => [i.quantity, i.grams])).toEqual([
      [120, 120],
      [3, 150],
    ])
  })

  it('returns how many items were added', async () => {
    expect(await addRecipeToShoppingList({ recipeId: porridge.id, servings: 2 })).toEqual({
      added: 2,
    })
  })

  it('keeps separate items when the same recipe is added twice', async () => {
    await addRecipeToShoppingList({ recipeId: porridge.id, servings: 2 })
    await addRecipeToShoppingList({ recipeId: porridge.id, servings: 2 })
    expect(items()).toHaveLength(4)
  })

  it('does not subtract the pantry when adding', async () => {
    insertPantry(oats.id, null)
    await addRecipeToShoppingList({ recipeId: porridge.id, servings: 2 })
    expect(items()[0].grams).toBe(80)
  })

  it('adds nothing for a recipe without ingredients', async () => {
    expect(await addRecipeToShoppingList({ recipeId: emptyRecipe.id, servings: 1 })).toEqual({
      added: 0,
    })
    expect(items()).toEqual([])
  })

  it('returns an error for an unknown recipe', async () => {
    expect(await addRecipeToShoppingList({ recipeId: 'missing', servings: 2 })).toEqual({
      error: 'Recipe not found',
    })
  })

  it('refuses a recipe the user cannot see', async () => {
    const hidden = insertRecipe(insertUser().id)
    expect(await addRecipeToShoppingList({ recipeId: hidden.id, servings: 1 })).toEqual({
      error: 'Recipe not found',
    })
  })

  it('returns the validation message for invalid servings', async () => {
    expect(await addRecipeToShoppingList({ recipeId: porridge.id, servings: 0 })).toEqual({
      error: 'Servings must be at least 1',
    })
  })

  it('revalidates the shopping page', async () => {
    await addRecipeToShoppingList({ recipeId: porridge.id, servings: 2 })
    expect(revalidatePath).toHaveBeenCalledWith('/shopping')
  })

  it('refuses to run without a signed-in user', async () => {
    vi.mocked(requireUser).mockRejectedValue(new Error('NEXT_REDIRECT'))
    await expect(addRecipeToShoppingList({ recipeId: porridge.id, servings: 2 })).rejects.toThrow()
    expect(items()).toEqual([])
  })
})

describe('addShoppingItem', () => {
  it('adds a free-text item with only a name', async () => {
    expect(await addShoppingItem({ name: 'Bin bags' })).toEqual({})
    expect(items()).toEqual([
      expect.objectContaining({
        name: 'Bin bags',
        ingredientId: null,
        grams: null,
        quantity: null,
        unit: null,
        recipeId: null,
      }),
    ])
  })

  it('stores the quantity and unit of a free-text item without grams', async () => {
    await addShoppingItem({ name: 'Batteries', quantity: 4, unit: 'pack' })
    expect(items()[0]).toMatchObject({ quantity: 4, unit: 'pack', grams: null })
  })

  it('resolves grams for a linked ingredient with a base unit', async () => {
    await addShoppingItem({ name: 'Oats', ingredientId: oats.id, quantity: 500, unit: 'ml' })
    expect(items()[0]).toMatchObject({ ingredientId: oats.id, grams: 200 })
  })

  it('resolves grams for a linked ingredient with a custom unit', async () => {
    await addShoppingItem({ name: 'Egg', ingredientId: egg.id, quantity: 6, unit: 'piece' })
    expect(items()[0].grams).toBe(300)
  })

  it('stores no grams when the unit is unknown for the ingredient', async () => {
    await addShoppingItem({ name: 'Egg', ingredientId: egg.id, quantity: 1, unit: 'dozen' })
    expect(items()[0]).toMatchObject({ ingredientId: egg.id, grams: null, unit: 'dozen' })
  })

  it('stores no grams for a linked ingredient without a quantity', async () => {
    await addShoppingItem({ name: 'Milk', ingredientId: milk.id, unit: 'l' })
    expect(items()[0]).toMatchObject({ ingredientId: milk.id, grams: null })
  })

  it('stores no grams for a linked ingredient without a unit', async () => {
    await addShoppingItem({ name: 'Egg', ingredientId: egg.id, quantity: 3 })
    expect(items()[0].grams).toBeNull()
  })

  it('uses the library name for a linked ingredient', async () => {
    await addShoppingItem({ name: 'eggs', ingredientId: egg.id })
    expect(items()[0].name).toBe('Egg')
  })

  it('returns an error for an unknown ingredient', async () => {
    expect(await addShoppingItem({ name: 'Ghost', ingredientId: 'missing' })).toEqual({
      error: 'Unknown ingredient',
    })
    expect(items()).toEqual([])
  })

  it('returns the validation message for a blank name', async () => {
    expect(await addShoppingItem({ name: ' ' })).toEqual({ error: 'Name is required' })
  })

  it('revalidates the shopping page', async () => {
    await addShoppingItem({ name: 'Bread' })
    expect(revalidatePath).toHaveBeenCalledWith('/shopping')
  })

  it('refuses to run without a signed-in user', async () => {
    vi.mocked(requireUser).mockRejectedValue(new Error('NEXT_REDIRECT'))
    await expect(addShoppingItem({ name: 'Bread' })).rejects.toThrow()
    expect(items()).toEqual([])
  })
})

describe('toggleShoppingItems', () => {
  it('checks the given items', async () => {
    const a = insertItem()
    const b = insertItem()
    await toggleShoppingItems([a.id, b.id], true)
    expect(items().map((i) => i.checked)).toEqual([true, true])
  })

  it('unchecks the given items', async () => {
    const a = insertItem({ checked: true })
    await toggleShoppingItems([a.id], false)
    expect(items()[0].checked).toBe(false)
  })

  it('leaves other items alone', async () => {
    const a = insertItem({ name: 'A' })
    insertItem({ name: 'B' })
    await toggleShoppingItems([a.id], true)
    expect(items().map((i) => [i.name, i.checked])).toEqual([
      ['A', true],
      ['B', false],
    ])
  })

  it('revalidates the shopping page', async () => {
    await toggleShoppingItems([insertItem().id], true)
    expect(revalidatePath).toHaveBeenCalledWith('/shopping')
  })

  it('refuses to run without a signed-in user', async () => {
    const a = insertItem()
    vi.mocked(requireUser).mockRejectedValue(new Error('NEXT_REDIRECT'))
    await expect(toggleShoppingItems([a.id], true)).rejects.toThrow()
    expect(items()[0].checked).toBe(false)
  })
})

describe('removeShoppingItems', () => {
  it('removes the given items', async () => {
    const a = insertItem({ name: 'A' })
    const b = insertItem({ name: 'B' })
    insertItem({ name: 'C' })
    await removeShoppingItems([a.id, b.id])
    expect(items().map((i) => i.name)).toEqual(['C'])
  })

  it('revalidates the shopping page', async () => {
    await removeShoppingItems([insertItem().id])
    expect(revalidatePath).toHaveBeenCalledWith('/shopping')
  })

  it('refuses to run without a signed-in user', async () => {
    const a = insertItem()
    vi.mocked(requireUser).mockRejectedValue(new Error('NEXT_REDIRECT'))
    await expect(removeShoppingItems([a.id])).rejects.toThrow()
    expect(items()).toHaveLength(1)
  })
})

describe('clearCheckedItems', () => {
  it('removes only checked items', async () => {
    insertItem({ name: 'Bought', checked: true })
    insertItem({ name: 'Still needed' })
    await clearCheckedItems()
    expect(items().map((i) => i.name)).toEqual(['Still needed'])
  })

  it('does not touch the pantry', async () => {
    insertItem({ checked: true })
    await clearCheckedItems()
    expect(pantry()).toEqual([])
  })

  it('revalidates the shopping page', async () => {
    await clearCheckedItems()
    expect(revalidatePath).toHaveBeenCalledWith('/shopping')
  })

  it('refuses to run without a signed-in user', async () => {
    insertItem({ checked: true })
    vi.mocked(requireUser).mockRejectedValue(new Error('NEXT_REDIRECT'))
    await expect(clearCheckedItems()).rejects.toThrow()
    expect(items()).toHaveLength(1)
  })
})

describe('clearShoppingList', () => {
  it('removes every item', async () => {
    insertItem({ checked: true })
    insertItem()
    insertItem({ ingredientId: null, name: 'Soap' })
    await clearShoppingList()
    expect(items()).toEqual([])
  })

  it('keeps the pantry', async () => {
    insertPantry(oats.id, 100)
    insertItem()
    await clearShoppingList()
    expect(pantry()).toEqual([{ ingredientId: oats.id, grams: 100 }])
  })

  it('revalidates the shopping page', async () => {
    await clearShoppingList()
    expect(revalidatePath).toHaveBeenCalledWith('/shopping')
  })

  it('refuses to run without a signed-in user', async () => {
    insertItem()
    vi.mocked(requireUser).mockRejectedValue(new Error('NEXT_REDIRECT'))
    await expect(clearShoppingList()).rejects.toThrow()
    expect(items()).toHaveLength(1)
  })
})

describe('setPantryItem', () => {
  it('adds an ingredient with an amount', async () => {
    expect(await setPantryItem({ ingredientId: oats.id, grams: 250 })).toEqual({})
    expect(pantry()).toEqual([{ ingredientId: oats.id, grams: 250 }])
  })

  it('adds an ingredient with an unknown amount', async () => {
    await setPantryItem({ ingredientId: oats.id, grams: null })
    expect(pantry()).toEqual([{ ingredientId: oats.id, grams: null }])
  })

  it('replaces the amount of an ingredient already in the pantry', async () => {
    insertPantry(oats.id, 250)
    await setPantryItem({ ingredientId: oats.id, grams: 40 })
    expect(pantry()).toEqual([{ ingredientId: oats.id, grams: 40 }])
  })

  it('can change a known amount to unknown', async () => {
    insertPantry(oats.id, 250)
    await setPantryItem({ ingredientId: oats.id, grams: null })
    expect(pantryGrams(oats.id)).toBeNull()
  })

  it('returns an error for an unknown ingredient', async () => {
    expect(await setPantryItem({ ingredientId: 'missing', grams: 1 })).toEqual({
      error: 'Unknown ingredient',
    })
    expect(pantry()).toEqual([])
  })

  it('returns the validation message for a zero amount', async () => {
    expect(await setPantryItem({ ingredientId: oats.id, grams: 0 })).toEqual({
      error: 'Amount must be > 0',
    })
  })

  it('revalidates the shopping page', async () => {
    await setPantryItem({ ingredientId: oats.id, grams: 1 })
    expect(revalidatePath).toHaveBeenCalledWith('/shopping')
  })

  it('refuses to run without a signed-in user', async () => {
    vi.mocked(requireUser).mockRejectedValue(new Error('NEXT_REDIRECT'))
    await expect(setPantryItem({ ingredientId: oats.id, grams: 1 })).rejects.toThrow()
    expect(pantry()).toEqual([])
  })
})

describe('removePantryItem', () => {
  it('removes the ingredient from the pantry', async () => {
    insertPantry(oats.id, 100)
    insertPantry(egg.id, null)
    await removePantryItem(oats.id)
    expect(pantry()).toEqual([{ ingredientId: egg.id, grams: null }])
  })

  it('revalidates the shopping page', async () => {
    await removePantryItem(oats.id)
    expect(revalidatePath).toHaveBeenCalledWith('/shopping')
  })

  it('refuses to run without a signed-in user', async () => {
    insertPantry(oats.id, 100)
    vi.mocked(requireUser).mockRejectedValue(new Error('NEXT_REDIRECT'))
    await expect(removePantryItem(oats.id)).rejects.toThrow()
    expect(pantry()).toHaveLength(1)
  })
})

describe('markBoughtIntoPantry', () => {
  it('adds a checked ingredient to an empty pantry', async () => {
    insertItem({ grams: 80, checked: true })
    await markBoughtIntoPantry()
    expect(pantry()).toEqual([{ ingredientId: oats.id, grams: 80 }])
  })

  it('sums several checked items of the same ingredient', async () => {
    insertItem({ grams: 80, checked: true })
    insertItem({ grams: 20, checked: true })
    await markBoughtIntoPantry()
    expect(pantryGrams(oats.id)).toBe(100)
  })

  it('adds bought grams to the amount already in the pantry', async () => {
    insertPantry(oats.id, 50)
    insertItem({ grams: 80, checked: true })
    await markBoughtIntoPantry()
    expect(pantryGrams(oats.id)).toBe(130)
  })

  it('keeps an unknown pantry amount unknown', async () => {
    insertPantry(oats.id, null)
    insertItem({ grams: 80, checked: true })
    await markBoughtIntoPantry()
    expect(pantryGrams(oats.id)).toBeNull()
  })

  it('makes the pantry amount unknown when a bought item has no grams', async () => {
    insertPantry(oats.id, 50)
    insertItem({ grams: null, checked: true })
    await markBoughtIntoPantry()
    expect(pantryGrams(oats.id)).toBeNull()
  })

  it('stores an unknown amount for a new ingredient bought without grams', async () => {
    insertItem({ ingredientId: egg.id, name: 'Egg', grams: null, checked: true })
    await markBoughtIntoPantry()
    expect(pantry()).toEqual([{ ingredientId: egg.id, grams: null }])
  })

  it('removes the moved items from the list', async () => {
    insertItem({ checked: true })
    await markBoughtIntoPantry()
    expect(items()).toEqual([])
  })

  it('leaves unchecked items on the list and out of the pantry', async () => {
    insertItem({ name: 'Unbought', ingredientId: egg.id, checked: false })
    await markBoughtIntoPantry()
    expect(items().map((i) => i.name)).toEqual(['Unbought'])
    expect(pantry()).toEqual([])
  })

  it('leaves checked free-text items on the list', async () => {
    insertItem({ ingredientId: null, name: 'Soap', grams: null, checked: true })
    await markBoughtIntoPantry()
    expect(items().map((i) => i.name)).toEqual(['Soap'])
    expect(pantry()).toEqual([])
  })

  it('returns how many ingredients were moved', async () => {
    insertItem({ checked: true })
    insertItem({ checked: true })
    insertItem({ ingredientId: egg.id, name: 'Egg', checked: true })
    expect(await markBoughtIntoPantry()).toEqual({ moved: 2 })
  })

  it('does nothing when nothing is checked', async () => {
    insertItem()
    expect(await markBoughtIntoPantry()).toEqual({ moved: 0 })
    expect(items()).toHaveLength(1)
  })

  it('revalidates the shopping page', async () => {
    await markBoughtIntoPantry()
    expect(revalidatePath).toHaveBeenCalledWith('/shopping')
  })

  it('refuses to run without a signed-in user', async () => {
    insertItem({ checked: true })
    vi.mocked(requireUser).mockRejectedValue(new Error('NEXT_REDIRECT'))
    await expect(markBoughtIntoPantry()).rejects.toThrow()
    expect(items()).toHaveLength(1)
    expect(pantry()).toEqual([])
  })
})

describe('active group', () => {
  function groupOf(itemName: string) {
    return db
      .select({ groupId: schema.shoppingItem.groupId })
      .from(schema.shoppingItem)
      .where(eq(schema.shoppingItem.name, itemName))
      .get()?.groupId
  }

  it('adds items to the user’s earliest group without a cookie', async () => {
    await addShoppingItem({ name: 'Bread' })
    expect(groupOf('Bread')).toBe(home.id)
  })

  it('adds items to the group chosen in the cookie', async () => {
    jar.set('group', cabin.id)
    await addShoppingItem({ name: 'Bread' })
    expect(groupOf('Bread')).toBe(cabin.id)
  })

  it('only clears the active group’s list', async () => {
    insertItem({ name: 'Home item' })
    jar.set('group', cabin.id)
    await clearShoppingList()
    expect(items().map((i) => i.name)).toEqual(['Home item'])
  })

  it('does not touch items of another group', async () => {
    const item = insertItem({ name: 'Home item' })
    jar.set('group', cabin.id)
    await removeShoppingItems([item.id])
    expect(items()).toHaveLength(1)
  })
})
