import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requireUser } from '@/lib/session'
import type { IngredientInput } from '@/lib/validation/ingredient'
import { setupTestDb } from '@/test/db'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/session', () => ({ requireUser: vi.fn() }))

const { db, schema, insertUser, insertIngredient } = await setupTestDb()
const { createIngredient, updateIngredient, deleteIngredient } = await import('./ingredients')

const user = insertUser()

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireUser).mockResolvedValue(user)
})

const oats: IngredientInput = {
  name: 'Oats',
  brand: 'Quaker',
  category: null,
  kcal: 380,
  protein: 13,
  carbs: 60,
  fat: 7,
  fiber: 10,
  density: 0.4,
  source: 'off',
  sourceId: '123',
  units: [{ name: 'cup', grams: 90 }],
}

async function created(input: IngredientInput) {
  const result = await createIngredient(input)
  if (result.error !== undefined) throw new Error(result.error)
  return result.id
}

function findIngredient(id: string) {
  return db.query.ingredient.findFirst({
    where: eq(schema.ingredient.id, id),
    with: { units: true },
  })
}

function unitsOf(id: string) {
  return db
    .select({ name: schema.ingredientUnit.name, grams: schema.ingredientUnit.grams })
    .from(schema.ingredientUnit)
    .where(eq(schema.ingredientUnit.ingredientId, id))
    .all()
}

function insertRecipeUsing(ingredientId: string, unit = 'g', quantity = 100) {
  const recipe = db
    .insert(schema.recipe)
    .values({ title: 'Oat bars', createdById: user.id })
    .returning()
    .get()
  return db
    .insert(schema.recipeIngredient)
    .values({ recipeId: recipe.id, ingredientId, quantity, unit, grams: quantity, position: 0 })
    .returning()
    .get()
}

function gramsOf(lineId: string) {
  return db
    .select({ grams: schema.recipeIngredient.grams })
    .from(schema.recipeIngredient)
    .where(eq(schema.recipeIngredient.id, lineId))
    .get()?.grams
}

describe('createIngredient', () => {
  it('stores the ingredient with its macros and source', async () => {
    const id = await created(oats)
    expect(await findIngredient(id)).toMatchObject({
      name: 'Oats',
      brand: 'Quaker',
      kcal: 380,
      fiber: 10,
      density: 0.4,
      source: 'off',
      sourceId: '123',
    })
  })

  it('records the signed-in user as the creator', async () => {
    const id = await created(oats)
    expect((await findIngredient(id))?.createdById).toBe(user.id)
  })

  it('stores the custom units', async () => {
    const id = await created(oats)
    expect(unitsOf(id)).toEqual([{ name: 'cup', grams: 90 }])
  })

  it('accepts an ingredient without custom units', async () => {
    const id = await created({ ...oats, units: [] })
    expect(unitsOf(id)).toEqual([])
  })

  it('returns the validation message for invalid input', async () => {
    expect(await createIngredient({ ...oats, name: '' })).toEqual({ error: 'Name is required' })
  })

  it('does not write anything when validation fails', async () => {
    const before = db.select().from(schema.ingredient).all().length
    await createIngredient({ ...oats, kcal: -5 })
    expect(db.select().from(schema.ingredient).all()).toHaveLength(before)
  })

  it('revalidates the ingredients page', async () => {
    await createIngredient(oats)
    expect(revalidatePath).toHaveBeenCalledWith('/ingredients')
  })

  it('refuses to run without a signed-in user', async () => {
    vi.mocked(requireUser).mockRejectedValue(new Error('NEXT_REDIRECT'))
    const before = db.select().from(schema.ingredient).all().length
    await expect(createIngredient(oats)).rejects.toThrow('NEXT_REDIRECT')
    expect(db.select().from(schema.ingredient).all()).toHaveLength(before)
  })
})

describe('updateIngredient', () => {
  it('updates the ingredient fields', async () => {
    const { id } = insertIngredient(user.id)
    await updateIngredient(id, { ...oats, name: 'Rolled oats', kcal: 370 })
    expect(await findIngredient(id)).toMatchObject({ name: 'Rolled oats', kcal: 370 })
  })

  it('replaces the custom units', async () => {
    const { id } = insertIngredient(user.id)
    db.insert(schema.ingredientUnit).values({ ingredientId: id, name: 'scoop', grams: 30 }).run()
    await updateIngredient(id, { ...oats, units: [{ name: 'cup', grams: 85 }] })
    expect(unitsOf(id)).toEqual([{ name: 'cup', grams: 85 }])
  })

  it('removes every custom unit when given none', async () => {
    const { id } = insertIngredient(user.id)
    db.insert(schema.ingredientUnit).values({ ingredientId: id, name: 'scoop', grams: 30 }).run()
    await updateIngredient(id, { ...oats, units: [] })
    expect(unitsOf(id)).toEqual([])
  })

  it('returns an error for an unknown ingredient', async () => {
    expect(await updateIngredient('missing', oats)).toEqual({ error: 'Ingredient not found' })
  })

  it('returns the validation message for invalid input', async () => {
    const { id } = insertIngredient(user.id)
    expect(await updateIngredient(id, { ...oats, density: 0 })).toEqual({
      error: 'Density must be > 0',
    })
  })

  it('recomputes recipe line grams when the density changes', async () => {
    const { id } = insertIngredient(user.id)
    const line = insertRecipeUsing(id, 'ml', 100)
    await updateIngredient(id, { ...oats, density: 0.5 })
    expect(gramsOf(line.id)).toBe(50)
  })

  it('recomputes recipe line grams when a custom unit weight changes', async () => {
    const { id } = insertIngredient(user.id)
    db.insert(schema.ingredientUnit).values({ ingredientId: id, name: 'cup', grams: 90 }).run()
    const line = insertRecipeUsing(id, 'cup', 2)
    await updateIngredient(id, { ...oats, units: [{ name: 'cup', grams: 80 }] })
    expect(gramsOf(line.id)).toBe(160)
  })

  it('refuses to remove a custom unit a recipe uses', async () => {
    const { id } = insertIngredient(user.id)
    db.insert(schema.ingredientUnit).values({ ingredientId: id, name: 'scoop', grams: 30 }).run()
    insertRecipeUsing(id, 'scoop', 1)
    expect(await updateIngredient(id, { ...oats, units: [] })).toEqual({
      error: 'Unit "scoop" is used by Oat bars',
    })
    expect(unitsOf(id)).toEqual([{ name: 'scoop', grams: 30 }])
  })

  it('revalidates every page because recipe nutrition may change', async () => {
    const { id } = insertIngredient(user.id)
    await updateIngredient(id, oats)
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout')
  })

  it('refuses to run without a signed-in user', async () => {
    const { id } = insertIngredient(user.id)
    vi.mocked(requireUser).mockRejectedValue(new Error('NEXT_REDIRECT'))
    await expect(updateIngredient(id, { ...oats, name: 'Changed' })).rejects.toThrow()
    expect((await findIngredient(id))?.name).toBe('Oats')
  })
})

describe('deleteIngredient', () => {
  it('deletes an unused ingredient', async () => {
    const { id } = insertIngredient(user.id)
    expect(await deleteIngredient(id)).toEqual({})
    expect(await findIngredient(id)).toBeUndefined()
  })

  it('deletes the ingredient’s custom units with it', async () => {
    const { id } = insertIngredient(user.id)
    db.insert(schema.ingredientUnit).values({ ingredientId: id, name: 'cup', grams: 90 }).run()
    await deleteIngredient(id)
    expect(unitsOf(id)).toEqual([])
  })

  it('refuses to delete an ingredient used by a recipe, naming the recipe', async () => {
    const { id } = insertIngredient(user.id)
    insertRecipeUsing(id)
    expect(await deleteIngredient(id)).toEqual({
      error: 'Used by Oat bars. Remove it from those recipes first.',
    })
    expect(await findIngredient(id)).toBeDefined()
  })

  it('revalidates the ingredients page', async () => {
    const { id } = insertIngredient(user.id)
    await deleteIngredient(id)
    expect(revalidatePath).toHaveBeenCalledWith('/ingredients')
  })

  it('refuses to run without a signed-in user', async () => {
    const { id } = insertIngredient(user.id)
    vi.mocked(requireUser).mockRejectedValue(new Error('NEXT_REDIRECT'))
    await expect(deleteIngredient(id)).rejects.toThrow()
    expect(await findIngredient(id)).toBeDefined()
  })
})
