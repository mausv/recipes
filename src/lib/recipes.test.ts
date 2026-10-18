import fs from 'node:fs'
import { asc, eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { pngBuffer, setupTestDb } from '@/test/db'

const { db, schema, insertUser, insertIngredient, insertGroup, insertRecipe, shareInto } =
  await setupTestDb()
const { imagePath, saveImage } = await import('./images')
const {
  copyRecipe,
  createRecipe,
  deleteRecipe,
  getRecipeWithNutrition,
  listRecipeShares,
  listRecipes,
  listTags,
  setCoverImage,
  shareRecipe,
  unshareRecipe,
  updateRecipe,
} = await import('./recipes')

const user = insertUser()
const home = insertGroup('Home', [user.id])
const oats = insertIngredient(user.id, { name: 'Oats', kcal: 380, fiber: 10 })
const milk = insertIngredient(user.id, { name: 'Milk', kcal: 60, protein: 3.4, carbs: 4.8, fat: 3 })

function insertRecipeWith(
  values: Partial<typeof schema.recipe.$inferInsert> = {},
  lines: { ingredientId: string; grams: number; groupName?: string }[] = []
) {
  const recipe = insertRecipe(user.id, { servings: 2, ...values })
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
  const recipe = await getRecipeWithNutrition(id, user.id)
  if (!recipe) throw new Error('Recipe not found')
  return recipe
}

describe('getRecipeWithNutrition', () => {
  it('returns null for an unknown recipe', async () => {
    expect(await getRecipeWithNutrition('missing', user.id)).toBeNull()
  })

  it('returns null for a recipe the user cannot see', async () => {
    expect(await getRecipeWithNutrition(insertRecipeWith().id, insertUser().id)).toBeNull()
  })

  it('returns a recipe shared into one of the user’s groups', async () => {
    const friend = insertUser()
    const group = insertGroup('Friends', [user.id, friend.id])
    const { id } = insertRecipeWith()
    shareInto(id, group.id, user.id)
    expect(await getRecipeWithNutrition(id, friend.id)).toMatchObject({ id })
  })

  it('includes the creator’s name', async () => {
    const recipe = await loaded(insertRecipeWith().id)
    expect(recipe.createdBy).toEqual({ name: 'Ana' })
  })

  it('returns ingredient lines in position order with their ingredient', async () => {
    const recipe = await loaded(insertRecipeWith({}, porridgeLines).id)
    expect(recipe.ingredients.map((l) => l.ingredient.name)).toEqual(['Milk', 'Oats'])
  })

  it('returns steps in position order', async () => {
    const { id } = insertRecipeWith()
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
    const { id } = insertRecipeWith({ coverImageId: cover.id })
    db.insert(schema.recipeStep)
      .values({ recipeId: id, text: 'Plate', imageId: photo.id, position: 0 })
      .run()
    const recipe = await loaded(id)
    expect(recipe.coverImage).toMatchObject({ width: 1600, height: 900 })
    expect(recipe.steps[0].image).toMatchObject({ width: 600, height: 800 })
  })

  it('computes total nutrition from the stored grams', async () => {
    const { nutrition } = await loaded(insertRecipeWith({}, porridgeLines).id)
    expect(nutrition.total.kcal).toBeCloseTo(310)
    expect(nutrition.totalGrams).toBe(250)
  })

  it('divides nutrition across the recipe servings', async () => {
    const { nutrition } = await loaded(insertRecipeWith({ servings: 2 }, porridgeLines).id)
    expect(nutrition.perServing.kcal).toBeCloseTo(155)
  })

  it('uses the cooked weight for per-100 g values', async () => {
    const { nutrition } = await loaded(
      insertRecipeWith({ cookedWeightGrams: 310 }, porridgeLines).id
    )
    expect(nutrition.per100g.kcal).toBeCloseTo(100)
  })

  it('treats unknown fiber as zero', async () => {
    const { nutrition } = await loaded(insertRecipeWith({}, porridgeLines).id)
    expect(nutrition.total.fiber).toBeCloseTo(5)
  })

  it('attaches each line’s scaled macros', async () => {
    const recipe = await loaded(insertRecipeWith({}, porridgeLines).id)
    expect(recipe.ingredients.map((l) => l.macros.kcal)).toEqual([120, 190])
  })

  it('returns zero nutrition for a recipe without ingredients', async () => {
    const { nutrition } = await loaded(insertRecipeWith().id)
    expect(nutrition.total.kcal).toBe(0)
  })
})

describe('listRecipes', () => {
  const tag = crypto.randomUUID()
  const soup = insertRecipeWith({ title: 'Lentil soup', tags: [tag, 'dinner'] })
  const salad = insertRecipeWith({ title: 'Green salad', tags: [tag, 'vegan-friendly'] })
  const porridge = insertRecipeWith({ title: 'Porridge', servings: 2 }, porridgeLines)

  function ids(filters: { q?: string; tag?: string }) {
    return listRecipes({ userId: user.id, groupId: home.id, scope: 'all', ...filters }).map(
      (r) => r.id
    )
  }

  function search(q: string) {
    return listRecipes({ userId: user.id, groupId: home.id, scope: 'all', q })
  }

  it('lists every recipe without filters', () => {
    expect(ids({})).toEqual(expect.arrayContaining([soup.id, salad.id, porridge.id]))
  })

  it('lists the newest recipes first', () => {
    const newest = insertRecipeWith({ title: 'Newest', createdAt: new Date(Date.now() + 60_000) })
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
    const row = search('Porridge').find((r) => r.id === porridge.id)
    expect(row?.kcalPerServing).toBeCloseTo(155)
  })

  it('reports zero kcal for a recipe without ingredients', () => {
    expect(search('Lentil')[0].kcalPerServing).toBe(0)
  })

  it('returns tags as an array', () => {
    expect(search('Lentil')[0].tags).toEqual([tag, 'dinner'])
  })

  it('includes the owner’s id and name', () => {
    expect(search('Lentil')[0]).toMatchObject({ createdById: user.id, ownerName: 'Ana' })
  })
})

describe('listRecipes scopes', () => {
  const ana = insertUser()
  const ben = insertUser()
  const kitchen = insertGroup('Kitchen', [ana.id, ben.id])
  const other = insertGroup('Other', [ana.id, ben.id])
  const own = insertRecipe(ana.id, { title: 'Own' })
  const ownShared = insertRecipe(ana.id, { title: 'Own shared' })
  const bens = insertRecipe(ben.id, { title: 'Ben’s' })
  const bensElsewhere = insertRecipe(ben.id, { title: 'Ben’s elsewhere' })
  const bensPrivate = insertRecipe(ben.id, { title: 'Ben’s private' })
  const zoe = insertUser()
  const foreign = insertGroup('Foreign', [ben.id, zoe.id])
  const bensForeign = insertRecipe(ben.id, { title: 'Ben’s foreign' })
  shareInto(ownShared.id, kitchen.id, ana.id)
  shareInto(bens.id, kitchen.id, ben.id)
  shareInto(bensElsewhere.id, other.id, ben.id)
  shareInto(bensForeign.id, foreign.id, ben.id)

  function titles(scope: 'all' | 'mine' | 'group') {
    return listRecipes({ userId: ana.id, groupId: kitchen.id, scope })
      .map((r) => r.title)
      .sort()
  }

  it('lists own recipes and those shared into the group for all', () => {
    expect(titles('all')).toEqual([bens.title, own.title, ownShared.title].sort())
  })

  it('lists only own recipes for mine', () => {
    expect(titles('mine')).toEqual([own.title, ownShared.title].sort())
  })

  it('lists only recipes shared into the group for group', () => {
    expect(titles('group')).toEqual([bens.title, ownShared.title].sort())
  })

  it('never lists another user’s unshared recipe', () => {
    expect(titles('all')).not.toContain(bensPrivate.title)
    expect(titles('all')).not.toContain(bensElsewhere.title)
  })

  it.each(['all', 'mine', 'group'] as const)(
    'hides a recipe shared into a group the user is not in for %s',
    (scope) => {
      expect(titles(scope)).not.toContain(bensForeign.title)
    }
  )
})

describe('listTags', () => {
  const ana = insertUser()
  const kitchen = insertGroup('Kitchen', [ana.id])
  insertRecipe(ana.id, { tags: ['zesty', 'apple'] })
  insertRecipe(ana.id, { tags: ['apple'] })
  insertRecipe(insertUser().id, { tags: ['hidden'] })

  function tags() {
    return listTags({ userId: ana.id, groupId: kitchen.id })
  }

  it('includes the tags of every visible recipe', () => {
    expect(tags()).toEqual(['apple', 'zesty'])
  })

  it('leaves out tags of recipes the user cannot see', () => {
    expect(tags()).not.toContain('hidden')
  })

  it('returns a tag used by several recipes once', () => {
    expect(tags().filter((t) => t === 'apple')).toHaveLength(1)
  })
})

describe('listTags scopes', () => {
  const ana = insertUser()
  const ben = insertUser()
  const kitchen = insertGroup('Kitchen', [ana.id, ben.id])
  const foreign = insertGroup('Foreign', [ben.id])
  insertRecipe(ana.id, { tags: ['own'] })
  shareInto(insertRecipe(ana.id, { tags: ['own-shared'] }).id, kitchen.id, ana.id)
  shareInto(insertRecipe(ben.id, { tags: ['bens'] }).id, kitchen.id, ben.id)
  shareInto(insertRecipe(ben.id, { tags: ['foreign'] }).id, foreign.id, ben.id)

  function tags(scope: 'all' | 'mine' | 'group') {
    return listTags({ userId: ana.id, groupId: kitchen.id, scope })
  }

  it('includes own and group tags for all', () => {
    expect(tags('all')).toEqual(['bens', 'own', 'own-shared'])
  })

  it('includes only tags of own recipes for mine', () => {
    expect(tags('mine')).toEqual(['own', 'own-shared'])
  })

  it('includes only tags of recipes shared into the group for group', () => {
    expect(tags('group')).toEqual(['bens', 'own-shared'])
  })

  it('defaults to all', () => {
    expect(listTags({ userId: ana.id, groupId: kitchen.id })).toEqual(tags('all'))
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

const emptyRecipe = {
  title: 'Toast',
  description: null,
  servings: 1,
  cookedWeightGrams: null,
  tags: [],
  coverImageId: null,
  ingredients: [],
  steps: [],
}

describe('owner-only changes', () => {
  const owner = insertUser()
  const friend = insertUser()
  const kitchen = insertGroup('Kitchen', [owner.id, friend.id])

  function sharedRecipe() {
    const recipe = insertRecipe(owner.id, { title: 'Shared' })
    shareInto(recipe.id, kitchen.id, owner.id)
    return recipe
  }

  function titleOf(id: string) {
    return db
      .select({ title: schema.recipe.title })
      .from(schema.recipe)
      .where(eq(schema.recipe.id, id))
      .get()?.title
  }

  it('lets a member it is shared with update the recipe', async () => {
    const { id } = sharedRecipe()
    expect(await updateRecipe(id, friend.id, emptyRecipe)).toEqual({ id })
    expect(titleOf(id)).toBe('Toast')
  })

  it('reports a recipe the user cannot see as not found', async () => {
    const { id } = sharedRecipe()
    expect(await updateRecipe(id, insertUser().id, emptyRecipe)).toEqual({
      error: 'Recipe not found',
    })
  })

  it('lets the owner update the recipe', async () => {
    const { id } = sharedRecipe()
    expect(await updateRecipe(id, owner.id, emptyRecipe)).toEqual({ id })
    expect(titleOf(id)).toBe('Toast')
  })

  it('refuses to delete a recipe for a member it is shared with', async () => {
    const { id } = sharedRecipe()
    expect(await deleteRecipe(id, friend.id)).toEqual({
      error: 'Only the owner can delete or share this recipe',
    })
    expect(titleOf(id)).toBe('Shared')
  })

  it('lets a member it is shared with set the cover', async () => {
    const { id } = sharedRecipe()
    expect(await setCoverImage(id, friend.id, null)).toEqual({})
  })

  it('reports the cover of a recipe the user cannot see as not found', async () => {
    const { id } = sharedRecipe()
    expect(await setCoverImage(id, insertUser().id, null)).toEqual({
      error: 'Recipe not found',
    })
  })
})

describe('copyRecipe', () => {
  const owner = insertUser()
  const friend = insertUser()
  const kitchen = insertGroup('Kitchen', [owner.id, friend.id])

  async function sharedRecipeWithImages() {
    const cover = await saveImage(await pngBuffer())
    const stepImage = await saveImage(await pngBuffer())
    const recipe = insertRecipe(owner.id, {
      title: 'Pie',
      description: 'Flaky',
      servings: 4,
      tags: ['baking'],
      coverImageId: cover.id,
    })
    db.update(schema.image).set({ recipeId: recipe.id }).where(eq(schema.image.id, cover.id)).run()
    db.update(schema.image)
      .set({ recipeId: recipe.id })
      .where(eq(schema.image.id, stepImage.id))
      .run()
    db.insert(schema.recipeIngredient)
      .values([
        {
          recipeId: recipe.id,
          ingredientId: oats.id,
          quantity: 1,
          unit: 'g',
          grams: 1,
          position: 0,
        },
        {
          recipeId: recipe.id,
          ingredientId: milk.id,
          quantity: 2,
          unit: 'g',
          grams: 2,
          groupName: 'Wet',
          position: 1,
        },
      ])
      .run()
    db.insert(schema.recipeStep)
      .values([
        { recipeId: recipe.id, text: 'Mix', position: 0 },
        { recipeId: recipe.id, text: 'Bake', imageId: stepImage.id, position: 1 },
      ])
      .run()
    shareInto(recipe.id, kitchen.id, owner.id)
    return { recipe, cover, stepImage }
  }

  async function copied(recipeId: string, userId = friend.id) {
    const result = await copyRecipe(recipeId, userId)
    if (result.error !== undefined) throw new Error(result.error)
    const copy = db.select().from(schema.recipe).where(eq(schema.recipe.id, result.id)).get()
    if (!copy) throw new Error('Copy not found')
    return copy
  }

  it('copies the recipe fields with the title unchanged', async () => {
    const { recipe } = await sharedRecipeWithImages()
    expect(await copied(recipe.id)).toMatchObject({
      title: 'Pie',
      description: 'Flaky',
      servings: 4,
      tags: ['baking'],
    })
  })

  it('makes the copying user the owner', async () => {
    const { recipe } = await sharedRecipeWithImages()
    expect((await copied(recipe.id)).createdById).toBe(friend.id)
  })

  it('does not share the copy into any group', async () => {
    const { recipe } = await sharedRecipeWithImages()
    expect(listRecipeShares((await copied(recipe.id)).id)).toEqual([])
  })

  it('copies the ingredient lines', async () => {
    const { recipe } = await sharedRecipeWithImages()
    const copy = await copied(recipe.id)
    const lines = db
      .select({
        ingredientId: schema.recipeIngredient.ingredientId,
        groupName: schema.recipeIngredient.groupName,
        position: schema.recipeIngredient.position,
      })
      .from(schema.recipeIngredient)
      .where(eq(schema.recipeIngredient.recipeId, copy.id))
      .orderBy(asc(schema.recipeIngredient.position))
      .all()
    expect(lines).toEqual([
      { ingredientId: oats.id, groupName: null, position: 0 },
      { ingredientId: milk.id, groupName: 'Wet', position: 1 },
    ])
  })

  it('copies the steps', async () => {
    const { recipe } = await sharedRecipeWithImages()
    const copy = await copied(recipe.id)
    const steps = db
      .select({ text: schema.recipeStep.text })
      .from(schema.recipeStep)
      .where(eq(schema.recipeStep.recipeId, copy.id))
      .orderBy(asc(schema.recipeStep.position))
      .all()
    expect(steps.map((s) => s.text)).toEqual(['Mix', 'Bake'])
  })

  it('copies the cover image into a new image file', async () => {
    const { recipe, cover } = await sharedRecipeWithImages()
    const copy = await copied(recipe.id)
    expect(copy.coverImageId).not.toBe(cover.id)
    expect(fs.readFileSync(imagePath(copy.coverImageId ?? ''))).toEqual(
      fs.readFileSync(imagePath(cover.id))
    )
  })

  it('attaches the copied images to the copy', async () => {
    const { recipe } = await sharedRecipeWithImages()
    const copy = await copied(recipe.id)
    const images = db.select().from(schema.image).where(eq(schema.image.recipeId, copy.id)).all()
    expect(images).toHaveLength(2)
  })

  it('points step images at the copied image', async () => {
    const { recipe, stepImage } = await sharedRecipeWithImages()
    const copy = await copied(recipe.id)
    const step = db
      .select({ imageId: schema.recipeStep.imageId })
      .from(schema.recipeStep)
      .where(eq(schema.recipeStep.recipeId, copy.id))
      .orderBy(asc(schema.recipeStep.position))
      .all()[1]
    expect(step.imageId).not.toBe(stepImage.id)
    expect(fs.existsSync(imagePath(step.imageId ?? ''))).toBe(true)
  })

  it('keeps the original images when the copy is deleted', async () => {
    const { recipe, cover } = await sharedRecipeWithImages()
    const copy = await copied(recipe.id)
    await deleteRecipe(copy.id, friend.id)
    expect(fs.existsSync(imagePath(cover.id))).toBe(true)
  })

  it('refuses a recipe the user cannot see', async () => {
    const { recipe } = await sharedRecipeWithImages()
    expect(await copyRecipe(recipe.id, insertUser().id)).toEqual({ error: 'Recipe not found' })
  })
})

describe('shareRecipe and unshareRecipe', () => {
  const owner = insertUser()
  const friend = insertUser()
  const kitchen = insertGroup('Kitchen', [owner.id, friend.id])

  it('shares the recipe into a group the owner is in', () => {
    const recipe = insertRecipe(owner.id)
    expect(shareRecipe(recipe.id, kitchen.id, owner.id)).toEqual({})
    expect(listRecipeShares(recipe.id)).toEqual([{ groupId: kitchen.id, name: 'Kitchen' }])
  })

  it('ignores sharing into the same group twice', () => {
    const recipe = insertRecipe(owner.id)
    shareRecipe(recipe.id, kitchen.id, owner.id)
    expect(shareRecipe(recipe.id, kitchen.id, owner.id)).toEqual({})
    expect(listRecipeShares(recipe.id)).toHaveLength(1)
  })

  it('refuses a group the owner is not in', () => {
    const recipe = insertRecipe(owner.id)
    const foreign = insertGroup('Foreign', [insertUser().id])
    expect(shareRecipe(recipe.id, foreign.id, owner.id)).toEqual({ error: 'Group not found' })
  })

  it('refuses a user who does not own the recipe', () => {
    const recipe = insertRecipe(owner.id)
    shareInto(recipe.id, kitchen.id, owner.id)
    const other = insertGroup('Other', [friend.id])
    expect(shareRecipe(recipe.id, other.id, friend.id)).toEqual({
      error: 'Only the owner can delete or share this recipe',
    })
  })

  it('unshares the recipe', () => {
    const recipe = insertRecipe(owner.id)
    shareInto(recipe.id, kitchen.id, owner.id)
    expect(unshareRecipe(recipe.id, kitchen.id, owner.id)).toEqual({})
    expect(listRecipeShares(recipe.id)).toEqual([])
  })

  it('refuses to unshare for a non-owner', () => {
    const recipe = insertRecipe(owner.id)
    shareInto(recipe.id, kitchen.id, owner.id)
    expect(unshareRecipe(recipe.id, kitchen.id, friend.id)).toEqual({
      error: 'Only the owner can delete or share this recipe',
    })
    expect(listRecipeShares(recipe.id)).toHaveLength(1)
  })
})
