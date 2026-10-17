import fs from 'node:fs'
import { asc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requireUser } from '@/lib/session'
import type { RecipeInput } from '@/lib/validation/recipe'
import { pngBuffer, setupTestDb } from '@/test/db'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/session', () => ({ requireUser: vi.fn() }))

const { db, schema, insertUser, insertIngredient } = await setupTestDb()
const { imagePath, saveImage } = await import('@/lib/images')
const { createRecipe, deleteRecipe, setCoverImage, updateRecipe, uploadRecipeImage } =
  await import('./recipes')

const user = insertUser()
const oats = insertIngredient(user.id, { density: 0.4 })
const egg = insertIngredient(user.id, { name: 'Egg', kcal: 143 })
db.insert(schema.ingredientUnit).values({ ingredientId: egg.id, name: 'piece', grams: 50 }).run()

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireUser).mockResolvedValue(user)
})

function recipeInput(overrides: Partial<RecipeInput> = {}): RecipeInput {
  return {
    title: 'Porridge',
    description: 'Creamy',
    servings: 2,
    cookedWeightGrams: null,
    tags: ['Breakfast'],
    coverImageId: null,
    ingredients: [
      { ingredientId: oats.id, quantity: 80, unit: 'g', groupName: null },
      { ingredientId: egg.id, quantity: 2, unit: 'piece', groupName: 'Topping' },
    ],
    steps: [
      { text: 'Simmer the oats', imageId: null },
      { text: 'Top with egg', imageId: null },
    ],
    ...overrides,
  }
}

async function created(input = recipeInput()) {
  const result = await createRecipe(input)
  if (result.error !== undefined) throw new Error(result.error)
  return result.id
}

function findRecipe(id: string) {
  return db.select().from(schema.recipe).where(eq(schema.recipe.id, id)).get()
}

function linesOf(id: string) {
  return db
    .select({
      ingredientId: schema.recipeIngredient.ingredientId,
      quantity: schema.recipeIngredient.quantity,
      unit: schema.recipeIngredient.unit,
      grams: schema.recipeIngredient.grams,
      groupName: schema.recipeIngredient.groupName,
      position: schema.recipeIngredient.position,
    })
    .from(schema.recipeIngredient)
    .where(eq(schema.recipeIngredient.recipeId, id))
    .orderBy(asc(schema.recipeIngredient.position))
    .all()
}

function stepsOf(id: string) {
  return db
    .select({
      text: schema.recipeStep.text,
      imageId: schema.recipeStep.imageId,
      position: schema.recipeStep.position,
    })
    .from(schema.recipeStep)
    .where(eq(schema.recipeStep.recipeId, id))
    .orderBy(asc(schema.recipeStep.position))
    .all()
}

function findImage(id: string) {
  return db.select().from(schema.image).where(eq(schema.image.id, id)).get()
}

async function upload() {
  return (await saveImage(await pngBuffer())).id
}

function imageForm(file: Blob | string) {
  const form = new FormData()
  form.set('file', file)
  return form
}

async function pngFile() {
  return new File([new Uint8Array(await pngBuffer())], 'photo.png', { type: 'image/png' })
}

describe('createRecipe', () => {
  it('stores the recipe fields', async () => {
    const id = await created()
    expect(findRecipe(id)).toMatchObject({
      title: 'Porridge',
      description: 'Creamy',
      servings: 2,
      cookedWeightGrams: null,
    })
  })

  it('stores normalised tags', async () => {
    const id = await created(recipeInput({ tags: [' Breakfast', 'breakfast', 'Quick'] }))
    expect(findRecipe(id)?.tags).toEqual(['breakfast', 'quick'])
  })

  it('records the signed-in user as the creator', async () => {
    const id = await created()
    expect(findRecipe(id)?.createdById).toBe(user.id)
  })

  it('stores ingredient lines in order with their positions', async () => {
    const id = await created()
    expect(linesOf(id).map((l) => [l.ingredientId, l.position])).toEqual([
      [oats.id, 0],
      [egg.id, 1],
    ])
  })

  it('resolves grams for base units', async () => {
    const id = await created()
    expect(linesOf(id)[0]).toMatchObject({ quantity: 80, unit: 'g', grams: 80 })
  })

  it('resolves grams for volume units using the ingredient density', async () => {
    const ingredients = [{ ingredientId: oats.id, quantity: 250, unit: 'ml', groupName: null }]
    const id = await created(recipeInput({ ingredients }))
    expect(linesOf(id)[0].grams).toBe(100)
  })

  it('resolves grams for custom units', async () => {
    const id = await created()
    expect(linesOf(id)[1]).toMatchObject({ quantity: 2, unit: 'piece', grams: 100 })
  })

  it('stores group names', async () => {
    const id = await created()
    expect(linesOf(id).map((l) => l.groupName)).toEqual([null, 'Topping'])
  })

  it('stores steps in order with their positions', async () => {
    const id = await created()
    expect(stepsOf(id)).toEqual([
      { text: 'Simmer the oats', imageId: null, position: 0 },
      { text: 'Top with egg', imageId: null, position: 1 },
    ])
  })

  it('accepts a recipe without ingredients or steps', async () => {
    const id = await created(recipeInput({ ingredients: [], steps: [] }))
    expect(linesOf(id)).toEqual([])
  })

  it('rejects a unit the ingredient does not define', async () => {
    const ingredients = [{ ingredientId: oats.id, quantity: 1, unit: 'piece', groupName: null }]
    expect(await createRecipe(recipeInput({ ingredients }))).toEqual({
      error: 'Unknown unit "piece" for Oats',
    })
  })

  it('rejects an unknown ingredient', async () => {
    const ingredients = [{ ingredientId: 'missing', quantity: 1, unit: 'g', groupName: null }]
    expect(await createRecipe(recipeInput({ ingredients }))).toEqual({
      error: 'Unknown ingredient',
    })
  })

  it('does not create a recipe when a line is invalid', async () => {
    const before = db.select().from(schema.recipe).all().length
    const ingredients = [{ ingredientId: oats.id, quantity: 1, unit: 'cup', groupName: null }]
    await createRecipe(recipeInput({ ingredients }))
    expect(db.select().from(schema.recipe).all()).toHaveLength(before)
  })

  it('returns the validation message for invalid input', async () => {
    expect(await createRecipe(recipeInput({ title: '' }))).toEqual({ error: 'Title is required' })
  })

  it('attaches the cover and step images to the recipe', async () => {
    const cover = await upload()
    const stepImage = await upload()
    const id = await created(
      recipeInput({ coverImageId: cover, steps: [{ text: 'Plate', imageId: stepImage }] })
    )
    expect(findImage(cover)?.recipeId).toBe(id)
    expect(findImage(stepImage)?.recipeId).toBe(id)
  })

  it('sets the cover image', async () => {
    const cover = await upload()
    const id = await created(recipeInput({ coverImageId: cover }))
    expect(findRecipe(id)?.coverImageId).toBe(cover)
  })

  it('revalidates the recipe list', async () => {
    await created()
    expect(revalidatePath).toHaveBeenCalledWith('/')
  })

  it('refuses to run without a signed-in user', async () => {
    vi.mocked(requireUser).mockRejectedValue(new Error('NEXT_REDIRECT'))
    const before = db.select().from(schema.recipe).all().length
    await expect(createRecipe(recipeInput())).rejects.toThrow('NEXT_REDIRECT')
    expect(db.select().from(schema.recipe).all()).toHaveLength(before)
  })
})

describe('updateRecipe', () => {
  it('updates the recipe fields', async () => {
    const id = await created()
    await updateRecipe(id, recipeInput({ title: 'Overnight oats', servings: 1 }))
    expect(findRecipe(id)).toMatchObject({ title: 'Overnight oats', servings: 1 })
  })

  it('replaces the ingredient lines', async () => {
    const id = await created()
    const ingredients = [{ ingredientId: egg.id, quantity: 3, unit: 'piece', groupName: null }]
    await updateRecipe(id, recipeInput({ ingredients }))
    expect(linesOf(id)).toEqual([
      {
        ingredientId: egg.id,
        quantity: 3,
        unit: 'piece',
        grams: 150,
        groupName: null,
        position: 0,
      },
    ])
  })

  it('replaces the steps', async () => {
    const id = await created()
    await updateRecipe(id, recipeInput({ steps: [{ text: 'Just eat it', imageId: null }] }))
    expect(stepsOf(id)).toEqual([{ text: 'Just eat it', imageId: null, position: 0 }])
  })

  it('keeps the old lines when a new line has an unknown unit', async () => {
    const id = await created()
    const ingredients = [{ ingredientId: egg.id, quantity: 1, unit: 'cup', groupName: null }]
    expect(await updateRecipe(id, recipeInput({ ingredients }))).toEqual({
      error: 'Unknown unit "cup" for Egg',
    })
    expect(linesOf(id)).toHaveLength(2)
  })

  it('returns an error for an unknown recipe', async () => {
    expect(await updateRecipe('missing', recipeInput())).toEqual({ error: 'Recipe not found' })
  })

  it('deletes images the recipe no longer references', async () => {
    const oldCover = await upload()
    const id = await created(recipeInput({ coverImageId: oldCover }))
    await updateRecipe(id, recipeInput({ coverImageId: await upload() }))
    expect(findImage(oldCover)).toBeUndefined()
    expect(fs.existsSync(imagePath(oldCover))).toBe(false)
  })

  it('keeps images the recipe still references', async () => {
    const cover = await upload()
    const id = await created(recipeInput({ coverImageId: cover }))
    await updateRecipe(id, recipeInput({ coverImageId: cover, title: 'Renamed' }))
    expect(findImage(cover)).toBeDefined()
  })

  it('attaches newly uploaded step images', async () => {
    const id = await created()
    const stepImage = await upload()
    await updateRecipe(id, recipeInput({ steps: [{ text: 'Plate', imageId: stepImage }] }))
    expect(findImage(stepImage)?.recipeId).toBe(id)
  })

  it('revalidates the list and the recipe page', async () => {
    const id = await created()
    await updateRecipe(id, recipeInput())
    expect(revalidatePath).toHaveBeenCalledWith('/')
    expect(revalidatePath).toHaveBeenCalledWith(`/recipes/${id}`)
  })

  it('refuses to run without a signed-in user', async () => {
    const id = await created()
    vi.mocked(requireUser).mockRejectedValue(new Error('NEXT_REDIRECT'))
    await expect(updateRecipe(id, recipeInput({ title: 'Changed' }))).rejects.toThrow()
    expect(findRecipe(id)?.title).toBe('Porridge')
  })
})

describe('deleteRecipe', () => {
  it('deletes the recipe with its lines and steps', async () => {
    const id = await created()
    expect(await deleteRecipe(id)).toEqual({})
    expect(findRecipe(id)).toBeUndefined()
    expect(linesOf(id)).toEqual([])
    expect(stepsOf(id)).toEqual([])
  })

  it('deletes the recipe’s image files and rows', async () => {
    const cover = await upload()
    const id = await created(recipeInput({ coverImageId: cover }))
    await deleteRecipe(id)
    expect(findImage(cover)).toBeUndefined()
    expect(fs.existsSync(imagePath(cover))).toBe(false)
  })

  it('leaves the ingredients in the library', async () => {
    const id = await created()
    await deleteRecipe(id)
    expect(
      db.select().from(schema.ingredient).where(eq(schema.ingredient.id, oats.id)).get()
    ).toBeDefined()
  })

  it('revalidates the recipe list', async () => {
    await deleteRecipe(await created())
    expect(revalidatePath).toHaveBeenCalledWith('/')
  })

  it('returns an error for an unknown recipe', async () => {
    expect(await deleteRecipe('missing')).toEqual({ error: 'Recipe not found' })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('refuses to run without a signed-in user', async () => {
    const id = await created()
    vi.mocked(requireUser).mockRejectedValue(new Error('NEXT_REDIRECT'))
    await expect(deleteRecipe(id)).rejects.toThrow()
    expect(findRecipe(id)).toBeDefined()
  })
})

describe('uploadRecipeImage', () => {
  it('stores the uploaded image and returns its id', async () => {
    const png = await pngFile()
    const result = await uploadRecipeImage(imageForm(png))
    expect(result.id && fs.existsSync(imagePath(result.id))).toBe(true)
  })

  it('leaves the image unattached until a recipe references it', async () => {
    const result = await uploadRecipeImage(imageForm(await pngFile()))
    expect(result.id && findImage(result.id)?.recipeId).toBeNull()
  })

  it('deletes unattached images older than a day', async () => {
    const stale = await upload()
    db.update(schema.image)
      .set({ createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) })
      .where(eq(schema.image.id, stale))
      .run()
    await uploadRecipeImage(imageForm(await pngFile()))
    expect(findImage(stale)).toBeUndefined()
  })

  it('rejects a form without a file', async () => {
    expect(await uploadRecipeImage(imageForm('text'))).toEqual({ error: 'Choose an image file' })
  })

  it('rejects a file that is not an image', async () => {
    const text = new File(['hello'], 'notes.txt', { type: 'text/plain' })
    expect(await uploadRecipeImage(imageForm(text))).toEqual({ error: 'Choose an image file' })
  })

  it('rejects an image larger than 10 MB', async () => {
    const huge = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'big.png', {
      type: 'image/png',
    })
    expect(await uploadRecipeImage(imageForm(huge))).toEqual({
      error: 'Image must be 10 MB or smaller',
    })
  })

  it('refuses to run without a signed-in user', async () => {
    vi.mocked(requireUser).mockRejectedValue(new Error('NEXT_REDIRECT'))
    const png = await pngFile()
    await expect(uploadRecipeImage(imageForm(png))).rejects.toThrow()
  })
})

describe('setCoverImage', () => {
  it('sets the recipe cover', async () => {
    const id = await created()
    const cover = await upload()
    await setCoverImage(id, cover)
    expect(findRecipe(id)?.coverImageId).toBe(cover)
  })

  it('attaches the new cover to the recipe', async () => {
    const id = await created()
    const cover = await upload()
    await setCoverImage(id, cover)
    expect(findImage(cover)?.recipeId).toBe(id)
  })

  it('deletes the previous cover image', async () => {
    const oldCover = await upload()
    const id = await created(recipeInput({ coverImageId: oldCover }))
    await setCoverImage(id, await upload())
    expect(findImage(oldCover)).toBeUndefined()
  })

  it('keeps the previous cover when a step still uses it', async () => {
    const shared = await upload()
    const id = await created(
      recipeInput({ coverImageId: shared, steps: [{ text: 'Plate', imageId: shared }] })
    )
    await setCoverImage(id, await upload())
    expect(findImage(shared)).toBeDefined()
  })

  it('clears the cover when given null', async () => {
    const id = await created(recipeInput({ coverImageId: await upload() }))
    await setCoverImage(id, null)
    expect(findRecipe(id)?.coverImageId).toBeNull()
  })

  it('returns an error for an unknown recipe', async () => {
    expect(await setCoverImage('missing', null)).toEqual({ error: 'Recipe not found' })
  })

  it('refuses to run without a signed-in user', async () => {
    const id = await created()
    vi.mocked(requireUser).mockRejectedValue(new Error('NEXT_REDIRECT'))
    await expect(setCoverImage(id, await upload())).rejects.toThrow()
    expect(findRecipe(id)?.coverImageId).toBeNull()
  })
})
