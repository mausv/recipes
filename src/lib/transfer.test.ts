import fs from 'node:fs'
import { and, eq } from 'drizzle-orm'
import sharp from 'sharp'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ExportDoc } from '@/lib/validation/transfer'
import { pngBuffer, setupTestDb } from '@/test/db'

const { db, schema, insertUser, insertIngredient, insertGroup } = await setupTestDb()
const { imagePath, saveImage } = await import('@/lib/images')
const { applyImport, buildExport, ImportError, importExport, parseExport } =
  await import('./transfer')

type IngredientEntry = ExportDoc['ingredients'][number]
type RecipeEntry = ExportDoc['recipes'][number]

const ana = insertUser()
const ben = db
  .insert(schema.user)
  .values({ id: crypto.randomUUID(), name: 'Ben', email: `${crypto.randomUUID()}@example.com` })
  .returning()
  .get()

function wipe() {
  for (const { id } of db.select({ id: schema.image.id }).from(schema.image).all()) {
    fs.rmSync(imagePath(id), { force: true })
  }
  db.delete(schema.shoppingItem).run()
  db.delete(schema.pantryItem).run()
  db.delete(schema.recipe).run()
  db.delete(schema.image).run()
  db.delete(schema.ingredient).run()
}

beforeEach(wipe)

async function seed() {
  const oats = insertIngredient(ana.id, {
    name: 'Oats',
    brand: 'Quaker',
    category: 'Grains',
    fiber: 10,
    density: 0.4,
    source: 'off',
    sourceId: '5000',
  })
  const milk = insertIngredient(ana.id, { name: 'Milk', brand: null, kcal: 64 })
  const salt = insertIngredient(ana.id, { name: 'Salt', kcal: 0 })
  db.insert(schema.ingredientUnit)
    .values([
      { ingredientId: oats.id, name: 'cup', grams: 90 },
      { ingredientId: oats.id, name: 'handful', grams: 30 },
    ])
    .run()

  const cover = await saveImage(await pngBuffer(40, 20))
  const stepImage = await saveImage(await pngBuffer(20, 40))
  const porridge = db
    .insert(schema.recipe)
    .values({
      title: 'Porridge',
      description: 'Creamy',
      servings: 2,
      cookedWeightGrams: 400,
      tags: ['breakfast'],
      coverImageId: cover.id,
      createdById: ana.id,
    })
    .returning()
    .get()
  const toast = db
    .insert(schema.recipe)
    .values({ title: 'Toast', createdById: ben.id })
    .returning()
    .get()
  db.update(schema.image).set({ recipeId: porridge.id }).run()

  db.insert(schema.recipeIngredient)
    .values([
      {
        recipeId: porridge.id,
        ingredientId: oats.id,
        quantity: 1,
        unit: 'cup',
        grams: 90,
        groupName: null,
        position: 0,
      },
      {
        recipeId: porridge.id,
        ingredientId: milk.id,
        quantity: 250,
        unit: 'ml',
        grams: 250,
        groupName: 'Liquid',
        position: 1,
      },
    ])
    .run()
  db.insert(schema.recipeStep)
    .values([
      { recipeId: porridge.id, text: 'Simmer', imageId: stepImage.id, position: 0 },
      { recipeId: porridge.id, text: 'Serve', imageId: null, position: 1 },
    ])
    .run()
  db.insert(schema.recipeComment)
    .values({
      recipeId: porridge.id,
      userId: ana.id,
      text: 'Delicious',
      createdAt: new Date('2026-03-01T08:00:00.000Z'),
    })
    .run()
  db.insert(schema.recipeNote)
    .values({
      recipeId: porridge.id,
      userId: ana.id,
      text: 'Less salt',
      updatedAt: new Date('2026-03-02T08:00:00.000Z'),
    })
    .run()

  return { oats, milk, salt, porridge, toast, cover, stepImage }
}

function ingredientEntry(overrides: Partial<IngredientEntry> = {}): IngredientEntry {
  return {
    id: crypto.randomUUID(),
    name: 'Oats',
    brand: null,
    category: null,
    kcal: 380,
    protein: 13,
    carbs: 60,
    fat: 7,
    fiber: null,
    density: 1,
    source: 'manual',
    sourceId: null,
    units: [],
    ...overrides,
  }
}

function recipeEntry(overrides: Partial<RecipeEntry> = {}): RecipeEntry {
  return {
    id: crypto.randomUUID(),
    title: 'Pancakes',
    description: null,
    servings: 1,
    cookedWeightGrams: null,
    tags: [],
    coverImageId: null,
    ingredients: [],
    steps: [],
    comments: [],
    notes: [],
    ...overrides,
  }
}

function line(ingredientId: string, position = 0): RecipeEntry['ingredients'][number] {
  return { ingredientId, quantity: 100, unit: 'g', grams: 100, groupName: null, position }
}

function docWith(parts: Partial<ExportDoc>): ExportDoc {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    ingredients: [],
    recipes: [],
    ...parts,
  }
}

async function webpImage() {
  const data = await sharp(await pngBuffer(12, 8))
    .webp()
    .toBuffer()
  return { id: crypto.randomUUID(), width: 12, height: 8, data: data.toString('base64') }
}

async function exported(options: Parameters<typeof buildExport>[0]) {
  return { ...(await buildExport(options)), exportedAt: 'ignored' }
}

function allRecipes() {
  return db.select().from(schema.recipe).all()
}

function allIngredients() {
  return db.select().from(schema.ingredient).all()
}

function linesOf(recipeId: string) {
  return db
    .select()
    .from(schema.recipeIngredient)
    .where(eq(schema.recipeIngredient.recipeId, recipeId))
    .all()
}

function commentsOf(recipeId: string) {
  return db
    .select()
    .from(schema.recipeComment)
    .where(eq(schema.recipeComment.recipeId, recipeId))
    .all()
}

function noteOf(recipeId: string, userId: string) {
  return db
    .select()
    .from(schema.recipeNote)
    .where(and(eq(schema.recipeNote.recipeId, recipeId), eq(schema.recipeNote.userId, userId)))
    .get()
}

describe('buildExport', () => {
  it('stamps the document with version 1 and the export time', async () => {
    const doc = await buildExport({ userId: ana.id, includeImages: false })
    expect(doc.version).toBe(1)
    expect(Date.parse(doc.exportedAt)).toBeGreaterThan(Date.now() - 60_000)
  })

  it('exports every ingredient in the library with its units', async () => {
    const { oats } = await seed()
    const doc = await buildExport({ userId: ana.id, includeImages: false })
    expect(doc.ingredients.map((i) => i.name)).toEqual(['Milk', 'Oats', 'Salt'])
    expect(doc.ingredients[1]).toEqual({
      id: oats.id,
      name: 'Oats',
      brand: 'Quaker',
      category: 'Grains',
      kcal: 380,
      protein: 13,
      carbs: 60,
      fat: 7,
      fiber: 10,
      density: 0.4,
      source: 'off',
      sourceId: '5000',
      units: [
        { name: 'cup', grams: 90 },
        { name: 'handful', grams: 30 },
      ],
    })
  })

  it('exports the recipe fields', async () => {
    const { porridge, cover } = await seed()
    const [exportedPorridge] = (await buildExport({ userId: ana.id, includeImages: false })).recipes
    expect(exportedPorridge).toMatchObject({
      id: porridge.id,
      title: 'Porridge',
      description: 'Creamy',
      servings: 2,
      cookedWeightGrams: 400,
      tags: ['breakfast'],
      coverImageId: cover.id,
    })
  })

  it('exports ingredient lines in position order', async () => {
    const { oats, milk } = await seed()
    const [exportedPorridge] = (await buildExport({ userId: ana.id, includeImages: false })).recipes
    expect(exportedPorridge.ingredients).toEqual([
      { ingredientId: oats.id, quantity: 1, unit: 'cup', grams: 90, groupName: null, position: 0 },
      {
        ingredientId: milk.id,
        quantity: 250,
        unit: 'ml',
        grams: 250,
        groupName: 'Liquid',
        position: 1,
      },
    ])
  })

  it('exports steps in position order with their image ids', async () => {
    const { stepImage } = await seed()
    const [exportedPorridge] = (await buildExport({ userId: ana.id, includeImages: false })).recipes
    expect(exportedPorridge.steps).toEqual([
      { text: 'Simmer', imageId: stepImage.id, position: 0 },
      { text: 'Serve', imageId: null, position: 1 },
    ])
  })

  it('exports comments with the author name', async () => {
    await seed()
    const [exportedPorridge] = (await buildExport({ userId: ana.id, includeImages: false })).recipes
    expect(exportedPorridge.comments).toEqual([
      { authorName: 'Ana', text: 'Delicious', createdAt: '2026-03-01T08:00:00.000Z' },
    ])
  })

  it('exports notes with the author name', async () => {
    await seed()
    const [exportedPorridge] = (await buildExport({ userId: ana.id, includeImages: false })).recipes
    expect(exportedPorridge.notes).toEqual([
      { authorName: 'Ana', text: 'Less salt', updatedAt: '2026-03-02T08:00:00.000Z' },
    ])
  })

  it('leaves out other users’ notes', async () => {
    const { porridge } = await seed()
    db.insert(schema.recipeNote)
      .values({ recipeId: porridge.id, userId: ben.id, text: 'Ben’s' })
      .run()
    const [exportedPorridge] = (await buildExport({ userId: ana.id, includeImages: false })).recipes
    expect(exportedPorridge.notes.map((n) => n.text)).toEqual(['Less salt'])
  })

  it('exports only the user’s own recipes sorted by title', async () => {
    await seed()
    db.insert(schema.recipe).values({ title: 'Apple pie', createdById: ana.id }).run()
    const doc = await buildExport({ userId: ana.id, includeImages: false })
    expect(doc.recipes.map((r) => r.title)).toEqual(['Apple pie', 'Porridge'])
  })

  it('limits the export to the requested recipes', async () => {
    const { toast } = await seed()
    const doc = await buildExport({ userId: ben.id, recipeIds: [toast.id], includeImages: false })
    expect(doc.recipes.map((r) => r.title)).toEqual(['Toast'])
  })

  it('leaves out a requested recipe owned by someone else', async () => {
    const { toast } = await seed()
    const doc = await buildExport({ userId: ana.id, recipeIds: [toast.id], includeImages: false })
    expect(doc.recipes).toEqual([])
  })

  it('only exports the ingredients the requested recipes use', async () => {
    const { porridge } = await seed()
    const doc = await buildExport({
      userId: ana.id,
      recipeIds: [porridge.id],
      includeImages: false,
    })
    expect(doc.ingredients.map((i) => i.name)).toEqual(['Milk', 'Oats'])
  })

  it('leaves images out unless asked to include them', async () => {
    await seed()
    expect((await buildExport({ userId: ana.id, includeImages: false })).images).toBeUndefined()
  })

  it('includes the cover and step images as base64 WebP', async () => {
    const { cover, stepImage } = await seed()
    const { images = [] } = await buildExport({ userId: ana.id, includeImages: true })
    expect(images.map((img) => img.id).sort()).toEqual([cover.id, stepImage.id].sort())
    const exportedCover = images.find((img) => img.id === cover.id)
    expect(exportedCover).toMatchObject({ width: 40, height: 20 })
    expect(Buffer.from(exportedCover?.data ?? '', 'base64')).toEqual(
      fs.readFileSync(imagePath(cover.id))
    )
  })

  it('only includes images of the requested recipes', async () => {
    const { toast } = await seed()
    const doc = await buildExport({ userId: ben.id, recipeIds: [toast.id], includeImages: true })
    expect(doc.images).toEqual([])
  })

  it('produces a document that passes validation', async () => {
    await seed()
    const doc = await buildExport({ userId: ana.id, includeImages: true })
    expect(parseExport(JSON.parse(JSON.stringify(doc)))).toEqual({ doc })
  })
})

describe('parseExport', () => {
  it('returns the parsed document', () => {
    const doc = docWith({ ingredients: [ingredientEntry()] })
    expect(parseExport(doc)).toEqual({ doc })
  })

  it('explains an unsupported version', () => {
    expect(parseExport({ ...docWith({}), version: 2 })).toEqual({
      error: 'Unsupported export version, expected version 1',
    })
  })

  it('names the path of an invalid field', () => {
    const recipes = [recipeEntry({ title: '' })]
    expect(parseExport(docWith({ recipes })).error).toMatch(
      /^Invalid export file: .+ at recipes\.0\.title$/
    )
  })

  it('rejects something that is not an object', () => {
    expect(parseExport([]).error).toMatch(/^Invalid export file: /)
  })
})

describe('applyImport round trip', () => {
  it('restores everything after export, wipe and merge import', async () => {
    await seed()
    const before = await exported({ userId: ana.id, includeImages: true })
    const doc = await buildExport({ userId: ana.id, includeImages: true })
    wipe()
    await applyImport(JSON.parse(JSON.stringify(doc)), { userId: ana.id, mode: 'merge' })
    expect(await exported({ userId: ana.id, includeImages: true })).toEqual(before)
  })

  it('restores everything after export and replace import', async () => {
    await seed()
    const before = await exported({ userId: ana.id, includeImages: true })
    const doc = await buildExport({ userId: ana.id, includeImages: true })
    db.insert(schema.recipe).values({ title: 'Leftover', createdById: ana.id }).run()
    await applyImport(doc, { userId: ana.id, mode: 'replace' })
    expect(await exported({ userId: ana.id, includeImages: true })).toEqual(before)
  })

  it('restores the image files byte for byte', async () => {
    const { cover } = await seed()
    const original = fs.readFileSync(imagePath(cover.id))
    const doc = await buildExport({ userId: ana.id, includeImages: true })
    wipe()
    await applyImport(doc, { userId: ana.id, mode: 'merge' })
    expect(fs.readFileSync(imagePath(cover.id))).toEqual(original)
  })

  it('attaches the restored images to their recipe', async () => {
    const { porridge, cover, stepImage } = await seed()
    const doc = await buildExport({ userId: ana.id, includeImages: true })
    wipe()
    await applyImport(doc, { userId: ana.id, mode: 'merge' })
    const owners = db.select({ recipeId: schema.image.recipeId }).from(schema.image).all()
    expect(owners).toEqual([{ recipeId: porridge.id }, { recipeId: porridge.id }])
    expect([cover.id, stepImage.id].every((id) => fs.existsSync(imagePath(id)))).toBe(true)
  })

  it('returns how many recipes, new ingredients and images it imported', async () => {
    await seed()
    const doc = await buildExport({ userId: ana.id, includeImages: true })
    wipe()
    expect(await applyImport(doc, { userId: ana.id, mode: 'merge' })).toEqual({
      ingredients: 3,
      recipes: 1,
      images: 2,
    })
  })
})

describe('applyImport merge', () => {
  it('inserts a new recipe with the id from the file', async () => {
    const entry = recipeEntry()
    await applyImport(docWith({ recipes: [entry] }), { userId: ana.id, mode: 'merge' })
    expect(allRecipes()).toMatchObject([{ id: entry.id, title: 'Pancakes' }])
  })

  it('records the importing user as the creator of new records', async () => {
    const oats = ingredientEntry()
    await applyImport(docWith({ ingredients: [oats], recipes: [recipeEntry()] }), {
      userId: ben.id,
      mode: 'merge',
    })
    expect(allRecipes()[0].createdById).toBe(ben.id)
    expect(allIngredients()[0].createdById).toBe(ben.id)
  })

  it('updates a recipe with the same id in place', async () => {
    const { porridge, salt } = await seed()
    const entry = recipeEntry({
      id: porridge.id,
      title: 'Salty porridge',
      ingredients: [line(salt.id)],
    })
    await applyImport(docWith({ recipes: [entry] }), { userId: ana.id, mode: 'merge' })
    expect(allRecipes().find((r) => r.id === porridge.id)?.title).toBe('Salty porridge')
    expect(linesOf(porridge.id).map((l) => l.ingredientId)).toEqual([salt.id])
  })

  it('leaves another user’s recipe with the same id untouched', async () => {
    const { toast } = await seed()
    const entry = recipeEntry({ id: toast.id, title: 'French toast' })
    await applyImport(docWith({ recipes: [entry] }), { userId: ana.id, mode: 'merge' })
    expect(allRecipes().find((r) => r.id === toast.id)).toMatchObject({
      title: 'Toast',
      createdById: ben.id,
    })
  })

  it('imports a recipe whose id belongs to another user as a new recipe of the importer', async () => {
    const { toast } = await seed()
    const entry = recipeEntry({ id: toast.id, title: 'French toast' })
    await applyImport(docWith({ recipes: [entry] }), { userId: ana.id, mode: 'merge' })
    expect(allRecipes().find((r) => r.title === 'French toast')).toMatchObject({
      createdById: ana.id,
    })
  })

  it('drops references to images attached to another user’s recipe', async () => {
    const { cover } = await seed()
    const entry = recipeEntry({ coverImageId: cover.id })
    await applyImport(docWith({ recipes: [entry] }), { userId: ben.id, mode: 'merge' })
    expect(allRecipes().find((r) => r.id === entry.id)?.coverImageId).toBeNull()
  })

  it('deletes the row of an image the updated recipe no longer references', async () => {
    const { porridge, cover, stepImage } = await seed()
    const entry = recipeEntry({ id: porridge.id, coverImageId: cover.id })
    await applyImport(docWith({ recipes: [entry] }), { userId: ana.id, mode: 'merge' })
    expect(
      db.select().from(schema.image).where(eq(schema.image.id, stepImage.id)).get()
    ).toBeUndefined()
  })

  it('deletes the file of an image the updated recipe no longer references', async () => {
    const { porridge, cover, stepImage } = await seed()
    const entry = recipeEntry({ id: porridge.id, coverImageId: cover.id })
    await applyImport(docWith({ recipes: [entry] }), { userId: ana.id, mode: 'merge' })
    expect(fs.existsSync(imagePath(stepImage.id))).toBe(false)
  })

  it('keeps the images the updated recipe still references', async () => {
    const { porridge, cover } = await seed()
    const entry = recipeEntry({ id: porridge.id, coverImageId: cover.id })
    await applyImport(docWith({ recipes: [entry] }), { userId: ana.id, mode: 'merge' })
    expect(fs.existsSync(imagePath(cover.id))).toBe(true)
  })

  it('keeps recipes that are not in the file', async () => {
    await seed()
    await applyImport(docWith({ recipes: [recipeEntry()] }), { userId: ana.id, mode: 'merge' })
    expect(
      allRecipes()
        .map((r) => r.title)
        .sort()
    ).toEqual(['Pancakes', 'Porridge', 'Toast'])
  })

  it('reuses an ingredient with the same id without duplicating it', async () => {
    const { oats } = await seed()
    const entry = ingredientEntry({ id: oats.id, name: 'Oats', brand: 'Quaker' })
    const recipe = recipeEntry({ ingredients: [line(oats.id)] })
    await applyImport(docWith({ ingredients: [entry], recipes: [recipe] }), {
      userId: ana.id,
      mode: 'merge',
    })
    expect(allIngredients()).toHaveLength(3)
    expect(linesOf(recipe.id)[0].ingredientId).toBe(oats.id)
  })

  it('matches an ingredient by name and brand ignoring case', async () => {
    const { oats } = await seed()
    const entry = ingredientEntry({ name: 'OATS', brand: 'quaker' })
    const recipe = recipeEntry({ ingredients: [line(entry.id)] })
    await applyImport(docWith({ ingredients: [entry], recipes: [recipe] }), {
      userId: ana.id,
      mode: 'merge',
    })
    expect(allIngredients()).toHaveLength(3)
    expect(linesOf(recipe.id)[0].ingredientId).toBe(oats.id)
  })

  it('treats a different brand as a different ingredient', async () => {
    await seed()
    const entry = ingredientEntry({ name: 'Oats', brand: 'Generic' })
    await applyImport(docWith({ ingredients: [entry] }), { userId: ana.id, mode: 'merge' })
    expect(allIngredients()).toHaveLength(4)
  })

  it('keeps the library values of a matched ingredient', async () => {
    const { oats } = await seed()
    const entry = ingredientEntry({ id: oats.id, name: 'Oats', brand: 'Quaker', kcal: 1 })
    await applyImport(docWith({ ingredients: [entry] }), { userId: ana.id, mode: 'merge' })
    expect(allIngredients().find((i) => i.id === oats.id)?.kcal).toBe(380)
  })

  it('adds units a matched ingredient is missing', async () => {
    const { oats } = await seed()
    const units = [
      { name: 'cup', grams: 100 },
      { name: 'scoop', grams: 40 },
    ]
    const entry = ingredientEntry({ id: oats.id, units })
    await applyImport(docWith({ ingredients: [entry] }), { userId: ana.id, mode: 'merge' })
    const stored = db
      .select({ name: schema.ingredientUnit.name, grams: schema.ingredientUnit.grams })
      .from(schema.ingredientUnit)
      .where(eq(schema.ingredientUnit.ingredientId, oats.id))
      .all()
    expect(stored.sort((a, b) => a.name.localeCompare(b.name))).toEqual([
      { name: 'cup', grams: 90 },
      { name: 'handful', grams: 30 },
      { name: 'scoop', grams: 40 },
    ])
  })

  it('accepts lines that reference an ingredient already in the library', async () => {
    const { salt } = await seed()
    const recipe = recipeEntry({ ingredients: [line(salt.id)] })
    await applyImport(docWith({ recipes: [recipe] }), { userId: ana.id, mode: 'merge' })
    expect(linesOf(recipe.id)[0].ingredientId).toBe(salt.id)
  })

  it('stores the exported grams of each line', async () => {
    const { salt } = await seed()
    const recipe = recipeEntry({
      ingredients: [{ ...line(salt.id), quantity: 2, unit: 'pinch', grams: 0.8 }],
    })
    await applyImport(docWith({ recipes: [recipe] }), { userId: ana.id, mode: 'merge' })
    expect(linesOf(recipe.id)[0]).toMatchObject({ quantity: 2, unit: 'pinch', grams: 0.8 })
  })

  it('attributes imported comments to the importing user', async () => {
    const recipe = recipeEntry({
      comments: [{ authorName: 'Zoe', text: 'Yum', createdAt: '2026-01-01T00:00:00.000Z' }],
    })
    await applyImport(docWith({ recipes: [recipe] }), { userId: ben.id, mode: 'merge' })
    expect(commentsOf(recipe.id)).toMatchObject([
      { userId: ben.id, text: 'Yum', createdAt: new Date('2026-01-01T00:00:00.000Z') },
    ])
  })

  it('does not duplicate comments when the same file is imported twice', async () => {
    const recipe = recipeEntry({
      comments: [{ authorName: 'Zoe', text: 'Yum', createdAt: '2026-01-01T00:00:00.000Z' }],
    })
    const doc = docWith({ recipes: [recipe] })
    await applyImport(doc, { userId: ana.id, mode: 'merge' })
    await applyImport(doc, { userId: ana.id, mode: 'merge' })
    expect(commentsOf(recipe.id)).toHaveLength(1)
  })

  it('keeps existing comments on an updated recipe', async () => {
    const { porridge } = await seed()
    const entry = recipeEntry({ id: porridge.id, title: 'Porridge' })
    await applyImport(docWith({ recipes: [entry] }), { userId: ana.id, mode: 'merge' })
    expect(commentsOf(porridge.id).map((c) => c.text)).toEqual(['Delicious'])
  })

  it('imports a note as the importing user’s private note', async () => {
    const recipe = recipeEntry({
      notes: [{ authorName: 'Zoe', text: 'Add cinnamon', updatedAt: '2026-01-01T00:00:00.000Z' }],
    })
    await applyImport(docWith({ recipes: [recipe] }), { userId: ben.id, mode: 'merge' })
    expect(noteOf(recipe.id, ben.id)).toMatchObject({
      text: 'Add cinnamon',
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    })
  })

  it('joins notes from several authors into one note', async () => {
    const recipe = recipeEntry({
      notes: [
        { authorName: 'Zoe', text: 'Add cinnamon', updatedAt: '2026-01-01T00:00:00.000Z' },
        { authorName: 'Yan', text: 'Use oat milk', updatedAt: '2026-02-01T00:00:00.000Z' },
      ],
    })
    await applyImport(docWith({ recipes: [recipe] }), { userId: ben.id, mode: 'merge' })
    expect(noteOf(recipe.id, ben.id)).toMatchObject({
      text: 'Add cinnamon\n\nUse oat milk',
      updatedAt: new Date('2026-02-01T00:00:00.000Z'),
    })
  })

  it('replaces an existing note with a newer one from the file', async () => {
    const { porridge } = await seed()
    const notes = [{ authorName: 'Ana', text: 'No salt', updatedAt: '2026-04-01T00:00:00.000Z' }]
    const entry = recipeEntry({ id: porridge.id, notes })
    await applyImport(docWith({ recipes: [entry] }), { userId: ana.id, mode: 'merge' })
    expect(noteOf(porridge.id, ana.id)?.text).toBe('No salt')
  })

  it('keeps an existing note that is newer than the one in the file', async () => {
    const { porridge } = await seed()
    const notes = [{ authorName: 'Ana', text: 'More salt', updatedAt: '2026-01-01T00:00:00.000Z' }]
    const entry = recipeEntry({ id: porridge.id, notes })
    await applyImport(docWith({ recipes: [entry] }), { userId: ana.id, mode: 'merge' })
    expect(noteOf(porridge.id, ana.id)?.text).toBe('Less salt')
  })

  it('stores new images and links them to the recipe', async () => {
    const img = await webpImage()
    const recipe = recipeEntry({ coverImageId: img.id })
    await applyImport(docWith({ recipes: [recipe], images: [img] }), {
      userId: ana.id,
      mode: 'merge',
    })
    expect(allRecipes()[0].coverImageId).toBe(img.id)
    expect(db.select().from(schema.image).all()).toMatchObject([
      { id: img.id, recipeId: recipe.id, width: 12, height: 8 },
    ])
    expect(fs.readFileSync(imagePath(img.id))).toEqual(Buffer.from(img.data, 'base64'))
  })

  it('skips images that are already stored', async () => {
    const { porridge } = await seed()
    const doc = await buildExport({ userId: ana.id, recipeIds: [porridge.id], includeImages: true })
    expect(await applyImport(doc, { userId: ana.id, mode: 'merge' })).toMatchObject({ images: 0 })
    expect(db.select().from(schema.image).all()).toHaveLength(2)
  })

  it('rewrites a stored image whose file went missing', async () => {
    const { porridge, cover } = await seed()
    const doc = await buildExport({ userId: ana.id, recipeIds: [porridge.id], includeImages: true })
    fs.rmSync(imagePath(cover.id))
    await applyImport(doc, { userId: ana.id, mode: 'merge' })
    expect(fs.existsSync(imagePath(cover.id))).toBe(true)
  })

  it('keeps image references to images that are already stored', async () => {
    const { porridge, cover } = await seed()
    const doc = await buildExport({
      userId: ana.id,
      recipeIds: [porridge.id],
      includeImages: false,
    })
    await applyImport(doc, { userId: ana.id, mode: 'merge' })
    expect(allRecipes().find((r) => r.id === porridge.id)?.coverImageId).toBe(cover.id)
  })

  it('drops image references the file and the library cannot satisfy', async () => {
    const missing = crypto.randomUUID()
    const recipe = recipeEntry({
      coverImageId: missing,
      steps: [{ text: 'Flip', imageId: missing, position: 0 }],
    })
    await applyImport(docWith({ recipes: [recipe] }), { userId: ana.id, mode: 'merge' })
    expect(allRecipes()[0].coverImageId).toBeNull()
    expect(db.select().from(schema.recipeStep).all()).toMatchObject([{ imageId: null }])
  })
})

describe('applyImport replace', () => {
  it('removes the user’s recipes that are not in the file', async () => {
    await seed()
    await applyImport(docWith({ recipes: [recipeEntry()] }), { userId: ana.id, mode: 'replace' })
    expect(
      allRecipes()
        .filter((r) => r.createdById === ana.id)
        .map((r) => r.title)
    ).toEqual(['Pancakes'])
  })

  it('keeps other users’ recipes', async () => {
    const { toast } = await seed()
    await applyImport(docWith({}), { userId: ana.id, mode: 'replace' })
    expect(allRecipes().map((r) => r.id)).toEqual([toast.id])
  })

  it('keeps the ingredient library', async () => {
    await seed()
    await applyImport(docWith({}), { userId: ana.id, mode: 'replace' })
    expect(allIngredients()).toHaveLength(3)
  })

  it('removes comments and notes of the old recipes', async () => {
    await seed()
    await applyImport(docWith({}), { userId: ana.id, mode: 'replace' })
    expect(db.select().from(schema.recipeComment).all()).toEqual([])
    expect(db.select().from(schema.recipeNote).all()).toEqual([])
  })

  it('leaves the shopping list and the pantry alone', async () => {
    const { oats } = await seed()
    const { id: groupId } = insertGroup('Home', [ana.id])
    db.insert(schema.shoppingItem).values({ groupId, name: 'Oats', ingredientId: oats.id }).run()
    db.insert(schema.pantryItem).values({ groupId, ingredientId: oats.id, grams: 500 }).run()
    await applyImport(docWith({}), { userId: ana.id, mode: 'replace' })
    expect(db.select().from(schema.shoppingItem).all()).toHaveLength(1)
    expect(db.select().from(schema.pantryItem).all()).toHaveLength(1)
  })

  it('deletes the old image rows and files', async () => {
    const { cover, stepImage } = await seed()
    await applyImport(docWith({}), { userId: ana.id, mode: 'replace' })
    expect(db.select().from(schema.image).all()).toEqual([])
    expect(fs.existsSync(imagePath(cover.id))).toBe(false)
    expect(fs.existsSync(imagePath(stepImage.id))).toBe(false)
  })

  it('keeps pending uploads no recipe uses yet', async () => {
    const pending = await saveImage(await pngBuffer())
    await applyImport(docWith({}), { userId: ana.id, mode: 'replace' })
    expect(fs.existsSync(imagePath(pending.id))).toBe(true)
  })

  it('drops image references when the file has no images', async () => {
    const { porridge } = await seed()
    const doc = await buildExport({ userId: ana.id, includeImages: false })
    await applyImport(doc, { userId: ana.id, mode: 'replace' })
    expect(allRecipes().find((r) => r.id === porridge.id)?.coverImageId).toBeNull()
  })

  it('reuses library ingredients instead of counting them as new', async () => {
    const { oats } = await seed()
    const doc = docWith({ ingredients: [ingredientEntry({ id: oats.id })] })
    expect(await applyImport(doc, { userId: ana.id, mode: 'replace' })).toMatchObject({
      ingredients: 0,
    })
  })
})

describe('applyImport failures', () => {
  it('rejects a line whose ingredient is neither in the file nor the library', async () => {
    const recipe = recipeEntry({ ingredients: [line(crypto.randomUUID())] })
    await expect(
      applyImport(docWith({ recipes: [recipe] }), { userId: ana.id, mode: 'merge' })
    ).rejects.toThrow(new ImportError('"Pancakes" uses an ingredient missing from the file'))
  })

  it('rolls back the database when an import fails', async () => {
    await seed()
    const before = await exported({ userId: ana.id, includeImages: false })
    const recipes = [recipeEntry(), recipeEntry({ ingredients: [line(crypto.randomUUID())] })]
    const doc = docWith({ ingredients: [ingredientEntry({ name: 'Spelt' })], recipes })
    await expect(applyImport(doc, { userId: ana.id, mode: 'replace' })).rejects.toThrow(ImportError)
    expect(await exported({ userId: ana.id, includeImages: false })).toEqual(before)
  })

  it('keeps the old image files when a replace import fails', async () => {
    const { cover } = await seed()
    const recipe = recipeEntry({ ingredients: [line(crypto.randomUUID())] })
    await expect(
      applyImport(docWith({ recipes: [recipe] }), { userId: ana.id, mode: 'replace' })
    ).rejects.toThrow(ImportError)
    expect(fs.existsSync(imagePath(cover.id))).toBe(true)
  })

  it('writes no image files when an import fails', async () => {
    const img = await webpImage()
    const recipe = recipeEntry({ coverImageId: img.id, ingredients: [line(crypto.randomUUID())] })
    await expect(
      applyImport(docWith({ recipes: [recipe], images: [img] }), { userId: ana.id, mode: 'merge' })
    ).rejects.toThrow(ImportError)
    expect(fs.existsSync(imagePath(img.id))).toBe(false)
  })

  it('rejects image data that is not WebP before touching the database', async () => {
    await seed()
    const png = (await pngBuffer()).toString('base64')
    const img = { ...(await webpImage()), data: png }
    await expect(
      applyImport(docWith({ images: [img] }), { userId: ana.id, mode: 'replace' })
    ).rejects.toThrow(new ImportError(`Image ${img.id} is not a valid WebP image`))
    expect(allRecipes()).toHaveLength(2)
  })

  it('rejects image data that is not an image at all', async () => {
    const img = { ...(await webpImage()), data: Buffer.from('hello').toString('base64') }
    await expect(
      applyImport(docWith({ images: [img] }), { userId: ana.id, mode: 'merge' })
    ).rejects.toThrow(ImportError)
  })
})

describe('importExport', () => {
  it('imports a valid export and returns the counts', async () => {
    const doc = docWith({ ingredients: [ingredientEntry()], recipes: [recipeEntry()] })
    expect(await importExport(doc, { userId: ana.id, mode: 'merge' })).toEqual({
      ingredients: 1,
      recipes: 1,
      images: 0,
    })
  })

  it('returns the parse error for an invalid export', async () => {
    expect(await importExport({ version: 2 }, { userId: ana.id, mode: 'merge' })).toEqual({
      error: 'Unsupported export version, expected version 1',
    })
  })

  it('returns an import error as a message', async () => {
    const recipe = recipeEntry({ ingredients: [line(crypto.randomUUID())] })
    expect(
      await importExport(docWith({ recipes: [recipe] }), { userId: ana.id, mode: 'merge' })
    ).toEqual({ error: '"Pancakes" uses an ingredient missing from the file' })
  })
})
