import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { eq, isNull, type SQL } from 'drizzle-orm'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { setupTestDb } from '@/test/db'

const { db, schema, insertUser } = await setupTestDb()
const { createMcpServer } = await import('./server')

const user = insertUser()

function itemIds(where: SQL) {
  return db
    .select({ id: schema.shoppingItem.id })
    .from(schema.shoppingItem)
    .where(where)
    .all()
    .map((row) => row.id)
}

const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
await createMcpServer(user.id).connect(serverTransport)
const client = new Client({ name: 'test', version: '1.0.0' })
await client.connect(clientTransport)

async function call(name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args })
  if (result.isError) throw new Error(JSON.stringify(result.content))
  return z.record(z.string(), z.unknown()).parse(result.structuredContent)
}

async function create(name: string, args: Record<string, unknown>) {
  return z.string().parse((await call(name, args)).id)
}

async function callError(name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args })
  expect(result.isError).toBe(true)
  return result.content
}

const oatsInput = {
  name: 'Oats',
  kcal: 380,
  protein: 13,
  carbs: 60,
  fat: 7,
  fiber: 10,
  density: 0.4,
  units: [{ name: 'cup', grams: 90 }],
}

describe('mcp server', () => {
  it('reports its name and instructions', () => {
    expect(client.getServerVersion()?.name).toBe('recipes')
    expect(client.getInstructions()).toContain('per 100 g')
  })

  it('lists the built-in units in its instructions', () => {
    expect(client.getInstructions()).toContain('ml, l, tsp, tbsp, cup, fl oz')
  })

  it('lists every tool', async () => {
    const { tools } = await client.listTools()
    expect(tools.map((t) => t.name).sort()).toEqual([
      'add_comment',
      'add_recipe_to_shopping_list',
      'add_shopping_item',
      'check_shopping_items',
      'clear_checked_items',
      'clear_shopping_list',
      'create_ingredient',
      'create_recipe',
      'delete_ingredient',
      'delete_recipe',
      'get_ingredient',
      'get_recipe',
      'get_shopping_list',
      'list_recipes',
      'list_tags',
      'lookup_nutrition',
      'move_bought_to_pantry',
      'remove_pantry_item',
      'remove_shopping_items',
      'save_note',
      'search_ingredients',
      'set_pantry_item',
      'update_ingredient',
      'update_recipe',
    ])
  })

  it('publishes JSON schemas for tool inputs', async () => {
    const { tools } = await client.listTools()
    const createRecipe = tools.find((t) => t.name === 'create_recipe')
    expect(createRecipe?.inputSchema.required).toEqual([
      'title',
      'servings',
      'ingredients',
      'steps',
    ])
  })

  it('runs the full recipe, shopping and pantry flow', async () => {
    const oatsId = await create('create_ingredient', oatsInput)
    const milkId = await create('create_ingredient', {
      name: 'Milk',
      kcal: 60,
      protein: 3.4,
      carbs: 4.8,
      fat: 3,
      density: 1.03,
    })

    expect(await call('search_ingredients', { q: 'oat' })).toMatchObject({
      ingredients: [{ id: oatsId, name: 'Oats', units: [{ name: 'cup', grams: 90 }] }],
    })
    expect(await call('get_ingredient', { id: milkId })).toMatchObject({
      name: 'Milk',
      brand: null,
      density: 1.03,
      source: 'manual',
    })

    const recipeId = await create('create_recipe', {
      title: 'Porridge',
      servings: 2,
      tags: ['Breakfast'],
      ingredients: [
        { ingredientId: oatsId, quantity: 1, unit: 'cup' },
        { ingredientId: milkId, quantity: 200, unit: 'ml', groupName: 'Liquid' },
      ],
      steps: [{ text: 'Simmer' }],
    })

    const kcal = 342 + 123.6
    expect(await call('get_recipe', { id: recipeId })).toMatchObject({
      title: 'Porridge',
      servings: 2,
      tags: ['breakfast'],
      ingredients: [
        {
          ingredientId: oatsId,
          name: 'Oats',
          quantity: 1,
          unit: 'cup',
          grams: 90,
          groupName: null,
        },
        { ingredientId: milkId, name: 'Milk', quantity: 200, unit: 'ml', groupName: 'Liquid' },
      ],
      steps: [{ text: 'Simmer', imageId: null }],
      nutrition: {
        total: { kcal: expect.closeTo(kcal) },
        perServing: { kcal: expect.closeTo(kcal / 2) },
        per100g: { kcal: expect.closeTo((kcal / 296) * 100) },
        perIngredient: [
          { name: 'Oats', grams: 90, kcal: expect.closeTo(342) },
          { name: 'Milk', grams: 206, kcal: expect.closeTo(123.6) },
        ],
      },
      comments: [],
      note: null,
    })

    expect(await call('list_recipes', { tag: 'breakfast' })).toMatchObject({
      recipes: [{ id: recipeId, title: 'Porridge', servings: 2, coverImageId: null }],
    })
    expect(await call('list_tags')).toEqual({ tags: ['breakfast'] })

    expect(await call('add_recipe_to_shopping_list', { recipeId, servings: 4 })).toEqual({
      added: 2,
    })
    await call('add_shopping_item', { name: 'Bin bags' })
    await call('set_pantry_item', { ingredientId: milkId, grams: 100 })

    expect(await call('get_shopping_list')).toMatchObject({
      needs: [
        { ingredientId: milkId, neededGrams: 412, haveGrams: 100, toBuyGrams: 312 },
        { ingredientId: oatsId, neededGrams: 180, haveGrams: 0, toBuyGrams: 180 },
      ],
      freeText: [{ name: 'Bin bags' }],
      pantry: [{ ingredientId: milkId, grams: 100 }],
    })

    await call('check_shopping_items', {
      ids: itemIds(eq(schema.shoppingItem.ingredientId, oatsId)),
      checked: true,
    })
    expect(await call('move_bought_to_pantry')).toEqual({ moved: 1 })
    expect(await call('get_shopping_list')).toMatchObject({
      needs: [{ ingredientId: milkId }],
      pantry: [
        { ingredientId: milkId, grams: 100 },
        { ingredientId: oatsId, grams: 180 },
      ],
    })

    await call('add_comment', { recipeId, text: 'Lovely' })
    await call('save_note', { recipeId, text: 'Less milk' })
    expect(await call('get_recipe', { id: recipeId })).toMatchObject({
      comments: [{ author: 'Ana', text: 'Lovely' }],
      note: 'Less milk',
    })

    await call('update_recipe', {
      id: recipeId,
      title: 'Oat porridge',
      servings: 1,
      ingredients: [{ ingredientId: oatsId, quantity: 50, unit: 'g' }],
      steps: [],
    })
    expect(await call('get_recipe', { id: recipeId })).toMatchObject({
      title: 'Oat porridge',
      ingredients: [{ grams: 50 }],
      steps: [],
    })

    await call('update_ingredient', { id: milkId, ...oatsInput, name: 'Whole milk', units: [] })
    expect(await call('get_ingredient', { id: milkId })).toMatchObject({ name: 'Whole milk' })

    await call('remove_pantry_item', { ingredientId: oatsId })
    await call('clear_checked_items')
    await call('remove_shopping_items', { ids: itemIds(isNull(schema.shoppingItem.ingredientId)) })
    expect(await call('get_shopping_list')).toMatchObject({ freeText: [] })
    await call('clear_shopping_list')
    expect(await call('get_shopping_list')).toEqual({
      needs: [],
      freeText: [],
      pantry: [{ ingredientId: milkId, grams: 100, name: 'Whole milk', brand: null }],
    })

    await call('delete_recipe', { id: recipeId })
    expect(await call('list_recipes')).toEqual({ recipes: [] })
    await call('delete_ingredient', { id: milkId })
    expect(await call('search_ingredients', { q: 'milk' })).toEqual({ ingredients: [] })
  })

  it('keeps the cover image when update_recipe omits it', async () => {
    const id = await create('create_recipe', {
      title: 'Toast',
      servings: 1,
      ingredients: [],
      steps: [],
    })
    const cover = db
      .insert(schema.image)
      .values({ recipeId: null, width: 1, height: 1 })
      .returning()
      .get()
    db.update(schema.recipe).set({ coverImageId: cover.id }).where(eq(schema.recipe.id, id)).run()
    await call('update_recipe', { id, title: 'Toast', servings: 1, ingredients: [], steps: [] })
    expect(await call('get_recipe', { id })).toMatchObject({ coverImageId: cover.id })
    await call('delete_recipe', { id })
  })

  it('returns domain errors as tool errors', async () => {
    expect(await callError('get_recipe', { id: 'missing' })).toEqual([
      { type: 'text', text: 'Recipe not found' },
    ])
    expect(
      await callError('create_recipe', {
        title: 'Ghost',
        servings: 1,
        ingredients: [{ ingredientId: 'missing', quantity: 1, unit: 'g' }],
        steps: [],
      })
    ).toEqual([{ type: 'text', text: 'Unknown ingredient' }])
    expect(await callError('add_comment', { recipeId: 'missing', text: 'Hi' })).toEqual([
      { type: 'text', text: 'Recipe not found' },
    ])
    expect(await callError('delete_recipe', { id: 'missing' })).toEqual([
      { type: 'text', text: 'Recipe not found' },
    ])
  })

  it('returns validation errors as tool errors', async () => {
    expect(await callError('create_ingredient', { ...oatsInput, kcal: -1 })).toEqual([
      { type: 'text', text: expect.stringContaining('Calories must be ≥ 0') },
    ])
  })

  it('refuses to delete an ingredient used by a recipe', async () => {
    const ingredientId = await create('create_ingredient', { ...oatsInput, units: [] })
    await call('create_recipe', {
      title: 'Granola',
      servings: 1,
      ingredients: [{ ingredientId, quantity: 10, unit: 'g' }],
      steps: [],
    })
    expect(await callError('delete_ingredient', { id: ingredientId })).toEqual([
      { type: 'text', text: 'Used by Granola. Remove it from those recipes first.' },
    ])
  })

  it('resolves grams for a recipe line in a built-in volume unit', async () => {
    const ingredientId = await create('create_ingredient', { ...oatsInput, units: [] })
    const id = await create('create_recipe', {
      title: 'Spiced oats',
      servings: 1,
      ingredients: [{ ingredientId, quantity: 3, unit: 'tsp' }],
      steps: [],
    })
    expect(await call('get_recipe', { id })).toMatchObject({
      ingredients: [{ quantity: 3, unit: 'tsp', grams: expect.closeTo(6) }],
    })
  })

  it('looks up nutrition from Open Food Facts', async () => {
    vi.stubEnv('USDA_API_KEY', '')
    const fetch = vi.fn().mockResolvedValue(
      Response.json({
        products: [
          {
            code: '123',
            product_name: 'Rolled oats',
            brands: 'Quaker, PepsiCo',
            nutriments: {
              'energy-kcal_100g': 375,
              proteins_100g: 13,
              carbohydrates_100g: 60,
              fat_100g: 7,
            },
          },
        ],
      })
    )
    vi.stubGlobal('fetch', fetch)
    expect(await call('lookup_nutrition', { q: 'oats' })).toEqual({
      results: [
        {
          source: 'off',
          sourceId: '123',
          name: 'Rolled oats',
          brand: 'Quaker',
          per100g: { kcal: 375, protein: 13, carbs: 60, fat: 7, fiber: null },
        },
      ],
    })
    expect(String(fetch.mock.calls[0][0])).toContain('search_terms=oats')
    vi.unstubAllGlobals()
  })
})
