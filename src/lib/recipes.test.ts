import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { setupTestDb } from '@/test/db'

const { db, schema, insertUser, insertIngredient } = await setupTestDb()
const { createRecipe, getRecipeWithNutrition, listRecipes, listTags } = await import('./recipes')

const user = insertUser()
const oats = insertIngredient(user.id, { name: 'Oats', kcal: 380, fiber: 10 })
const milk = insertIngredient(user.id, { name: 'Milk', kcal: 60, protein: 3.4, carbs: 4.8, fat: 3 })

function insertRecipe(
  values: Partial<typeof schema.recipe.$inferInsert> = {},
  lines: { ingredientId: string; grams: number; groupName?: string }[] = []
) {
  const recipe = db
    .insert(schema.recipe)
    .values({ title: 'Porridge', servings: 2, createdById: user.id, ...values })
    .returning()
    .get()
  lines.forEach((line, position) =>
    db
      .insert(schema.recipeIngredient)
      .values({ ...line, recipeId: recipe.id, quantity: line.grams, unit: 'g', position })
      .run()
  )
  return recipe
}

const porridgeLines = [
  { ingredientId: milk.id, grams: 200 },
  { ingredientId: oats.id, grams: 50 },
]

async function loaded(id: string) {
  const recipe = await getRecipeWithNutrition(id)
  if (!recipe) throw new Error('Recipe not found')
  return recipe
}

describe('getRecipeWithNutrition', () => {
  it('returns null for an unknown recipe', async () => {
    expect(await getRecipeWithNutrition('missing')).toBeNull()
  })

  it('includes the creator’s name', async () => {
    const recipe = await loaded(insertRecipe().id)
    expect(recipe.createdBy).toEqual({ name: 'Ana' })
  })

  it('returns ingredient lines in position order with their ingredient', async () => {
    const recipe = await loaded(insertRecipe({}, porridgeLines).id)
    expect(recipe.ingredients.map((l) => l.ingredient.name)).toEqual(['Milk', 'Oats'])
  })

  it('returns steps in position order', async () => {
    const { id } = insertRecipe()
    db.insert(schema.recipeStep)
      .values([
        { recipeId: id, text: 'Second', position: 1 },
        { recipeId: id, text: 'First', position: 0 },
      ])
      .run()
    expect((await loaded(id)).steps.map((s) => s.text)).toEqual(['First', 'Second'])
  })

  it('includes the cover and step images with their dimensions', async () => {
    const cover = db.insert(schema.image).values({ width: 1600, height: 900 }).returning().get()
    const photo = db.insert(schema.image).values({ width: 600, height: 800 }).returning().get()
    const { id } = insertRecipe({ coverImageId: cover.id })
    db.insert(schema.recipeStep)
      .values({ recipeId: id, text: 'Plate', imageId: photo.id, position: 0 })
      .run()
    const recipe = await loaded(id)
    expect(recipe.coverImage).toMatchObject({ width: 1600, height: 900 })
    expect(recipe.steps[0].image).toMatchObject({ width: 600, height: 800 })
  })

  it('computes total nutrition from the stored grams', async () => {
    const { nutrition } = await loaded(insertRecipe({}, porridgeLines).id)
    expect(nutrition.total.kcal).toBeCloseTo(310)
    expect(nutrition.totalGrams).toBe(250)
  })

  it('divides nutrition across the recipe servings', async () => {
    const { nutrition } = await loaded(insertRecipe({ servings: 2 }, porridgeLines).id)
    expect(nutrition.perServing.kcal).toBeCloseTo(155)
  })

  it('uses the cooked weight for per-100 g values', async () => {
    const { nutrition } = await loaded(insertRecipe({ cookedWeightGrams: 310 }, porridgeLines).id)
    expect(nutrition.per100g.kcal).toBeCloseTo(100)
  })

  it('treats unknown fiber as zero', async () => {
    const { nutrition } = await loaded(insertRecipe({}, porridgeLines).id)
    expect(nutrition.total.fiber).toBeCloseTo(5)
  })

  it('attaches each line’s scaled macros', async () => {
    const recipe = await loaded(insertRecipe({}, porridgeLines).id)
    expect(recipe.ingredients.map((l) => l.macros.kcal)).toEqual([120, 190])
  })

  it('returns zero nutrition for a recipe without ingredients', async () => {
    const { nutrition } = await loaded(insertRecipe().id)
    expect(nutrition.total.kcal).toBe(0)
  })
})

describe('listRecipes', () => {
  const tag = crypto.randomUUID()
  const soup = insertRecipe({ title: 'Lentil soup', tags: [tag, 'dinner'] })
  const salad = insertRecipe({ title: 'Green salad', tags: [tag, 'vegan-friendly'] })
  const porridge = insertRecipe({ title: 'Porridge', servings: 2 }, porridgeLines)

  function ids(filters: { q?: string; tag?: string }) {
    return listRecipes(filters).map((r) => r.id)
  }

  it('lists every recipe without filters', () => {
    expect(ids({})).toEqual(expect.arrayContaining([soup.id, salad.id, porridge.id]))
  })

  it('lists the newest recipes first', () => {
    const newest = insertRecipe({ title: 'Newest', createdAt: new Date(Date.now() + 60_000) })
    expect(ids({})[0]).toBe(newest.id)
  })

  it('matches the search against the title, case-insensitively', () => {
    expect(ids({ q: 'LENTIL' })).toEqual([soup.id])
  })

  it('matches the search against tags', () => {
    expect(ids({ q: 'vegan' })).toEqual([salad.id])
  })

  it('treats % in the search as a literal character', () => {
    expect(ids({ q: '%' })).toEqual([])
  })

  it('filters by an exact tag', () => {
    expect(ids({ tag }).sort()).toEqual([soup.id, salad.id].sort())
  })

  it('does not match a partial tag in the tag filter', () => {
    expect(ids({ tag: 'dinn' })).toEqual([])
  })

  it('combines search and tag filters', () => {
    expect(ids({ q: 'salad', tag })).toEqual([salad.id])
  })

  it('computes kcal per serving from the ingredient lines', () => {
    const row = listRecipes({ q: 'Porridge' }).find((r) => r.id === porridge.id)
    expect(row?.kcalPerServing).toBeCloseTo(155)
  })

  it('reports zero kcal for a recipe without ingredients', () => {
    expect(listRecipes({ q: 'Lentil' })[0].kcalPerServing).toBe(0)
  })

  it('returns tags as an array', () => {
    expect(listRecipes({ q: 'Lentil' })[0].tags).toEqual([tag, 'dinner'])
  })
})

describe('listTags', () => {
  insertRecipe({ tags: ['zesty', 'apple'] })
  insertRecipe({ tags: ['apple'] })

  it('includes the tags of every recipe', () => {
    expect(listTags()).toEqual(expect.arrayContaining(['apple', 'zesty']))
  })

  it('returns a tag used by several recipes once', () => {
    expect(listTags().filter((t) => t === 'apple')).toHaveLength(1)
  })

  it('sorts the tags alphabetically', () => {
    const tags = listTags()
    expect(tags).toEqual([...tags].sort())
  })
})

describe('createRecipe', () => {
  it('stores grams for a tablespoon line using the ingredient density', () => {
    const cream = insertIngredient(user.id, { name: 'Cream', density: 1.03 })
    const result = createRecipe(user.id, {
      title: 'Coffee',
      description: null,
      servings: 1,
      cookedWeightGrams: null,
      tags: [],
      coverImageId: null,
      ingredients: [{ ingredientId: cream.id, quantity: 2, unit: 'tbsp', groupName: null }],
      steps: [],
    })
    if (result.error !== undefined) throw new Error(result.error)
    const line = db
      .select({ grams: schema.recipeIngredient.grams })
      .from(schema.recipeIngredient)
      .where(eq(schema.recipeIngredient.recipeId, result.id))
      .get()
    expect(line?.grams).toBeCloseTo(30.9)
  })
})
