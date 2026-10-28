import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { eq, isNull, type SQL } from 'drizzle-orm'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { setupTestDb } from '@/test/db'

const { db, schema, insertUser, insertGroup, insertRecipe, shareInto } = await setupTestDb()
const { createMcpServer } = await import('./server')
const { localDate, mondayOf } = await import('@/lib/meal-plan')

const user = insertUser()
const friend = insertUser()
const home = insertGroup('Home', [user.id, friend.id])

function itemIds(where: SQL) {
  return db
    .select({ id: schema.shoppingItem.id })
    .from(schema.shoppingItem)
    .where(where)
    .all()
    .map((row) => row.id)
}

async function connect(userId: string) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await createMcpServer(userId).connect(serverTransport)
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

  return { client, call, create, callError }
}

const { client, call, create, callError } = await connect(user.id)

const cook = insertUser()
const kitchen = insertGroup('Kitchen', [cook.id])
const cabin = insertGroup('Cabin', [cook.id, friend.id])
const asCook = await connect(cook.id)

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

  it('tells Claude to call list_groups when the user has several groups', () => {
    expect(client.getInstructions()).toContain('call list_groups first')
  })

  it('lists every tool', async () => {
    const { tools } = await client.listTools()
    expect(tools.map((t) => t.name).sort()).toEqual([
      'add_comment',
      'add_meal',
      'add_recipe_to_shopping_list',
      'add_shopping_item',
      'add_week_to_shopping_list',
      'check_shopping_items',
      'clear_checked_items',
      'clear_shopping_list',
      'copy_recipe',
      'create_group',
      'create_ingredient',
      'create_invite_link',
      'create_recipe',
      'delete_ingredient',
      'delete_recipe',
      'get_ingredient',
      'get_month_plan',
      'get_recipe',
      'get_shopping_list',
      'get_week_plan',
      'leave_group',
      'list_groups',
      'list_recipe_shares',
      'list_recipes',
      'list_tags',
      'lookup_nutrition',
      'move_bought_to_pantry',
      'move_meal',
      'remove_meal',
      'remove_pantry_item',
      'remove_shopping_items',
      'save_note',
      'search_ingredients',
      'set_pantry_item',
      'share_recipe',
      'unshare_recipe',
      'update_ingredient',
      'update_meal',
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
    expect(await call('get_ingredient', { id: oatsId })).toMatchObject({ category: null })
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

  it('keeps the photo focus points when update_recipe runs', async () => {
    const [cover, photo] = db
      .insert(schema.image)
      .values([
        { recipeId: null, width: 1, height: 1 },
        { recipeId: null, width: 1, height: 1 },
      ])
      .returning()
      .all()
    const id = await create('create_recipe', {
      title: 'Toast',
      servings: 1,
      coverImageId: cover.id,
      ingredients: [],
      steps: [{ text: 'Plate', imageId: photo.id }],
    })
    db.update(schema.recipe)
      .set({ coverFocusX: 10, coverFocusY: 20 })
      .where(eq(schema.recipe.id, id))
      .run()
    db.update(schema.recipeStep)
      .set({ imageFocusX: 30, imageFocusY: 40 })
      .where(eq(schema.recipeStep.recipeId, id))
      .run()
    await call('update_recipe', {
      id,
      title: 'Toast',
      servings: 1,
      ingredients: [],
      steps: [{ text: 'Plate on a board', imageId: photo.id }],
    })
    expect(db.select().from(schema.recipe).where(eq(schema.recipe.id, id)).get()).toMatchObject({
      coverFocusX: 10,
      coverFocusY: 20,
    })
    expect(
      db.select().from(schema.recipeStep).where(eq(schema.recipeStep.recipeId, id)).all()
    ).toMatchObject([{ text: 'Plate on a board', imageFocusX: 30, imageFocusY: 40 }])
    await call('delete_recipe', { id })
  })

  it('does not take focus points in recipe tools', async () => {
    const { tools } = await client.listTools()
    const schemas = JSON.stringify(
      tools.filter((t) => t.name.endsWith('_recipe')).map((t) => t.inputSchema)
    )
    expect(schemas).not.toMatch(/Focus/)
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

  it('stores the category given to create_ingredient', async () => {
    const id = await create('create_ingredient', { ...oatsInput, category: 'Grains', units: [] })
    expect(await call('get_ingredient', { id })).toMatchObject({ category: 'Grains' })
    await call('delete_ingredient', { id })
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

  it('uses the caller’s only group when groupId is omitted', async () => {
    await call('add_shopping_item', { name: 'Candles' })
    expect(itemIds(eq(schema.shoppingItem.groupId, home.id))).toHaveLength(1)
    await call('clear_shopping_list')
  })

  it('hides recipes that are not shared with the user', async () => {
    const hidden = insertRecipe(insertUser().id, { title: 'Secret' })
    expect(await callError('get_recipe', { id: hidden.id })).toEqual([
      { type: 'text', text: 'Recipe not found' },
    ])
    expect(await call('list_recipes', { q: 'Secret' })).toEqual({ recipes: [] })
  })

  it('shows a friend’s recipe shared into the group but refuses to delete it', async () => {
    const shared = insertRecipe(friend.id, { title: 'Friend’s stew' })
    shareInto(shared.id, home.id, friend.id)
    expect(await call('list_recipes', { q: 'stew' })).toMatchObject({
      recipes: [{ id: shared.id }],
    })
    expect(await callError('delete_recipe', { id: shared.id })).toEqual([
      { type: 'text', text: 'Only the owner can delete or share this recipe' },
    ])
  })

  it('updates a friend’s recipe shared into the group', async () => {
    const shared = insertRecipe(friend.id, { title: 'Friend’s soup' })
    shareInto(shared.id, home.id, friend.id)
    await call('update_recipe', {
      id: shared.id,
      title: 'Friend’s better soup',
      servings: 2,
      ingredients: [],
      steps: [],
    })
    expect(await call('get_recipe', { id: shared.id })).toMatchObject({
      title: 'Friend’s better soup',
    })
  })

  it('marks list_recipes results with their owner and whether they are yours', async () => {
    const mine = insertRecipe(user.id, { title: 'Ownership soup' })
    const theirs = insertRecipe(friend.id, { title: 'Ownership stew' })
    shareInto(theirs.id, home.id, friend.id)
    const { recipes } = await call('list_recipes', { q: 'Ownership' })
    expect(recipes).toHaveLength(2)
    expect(recipes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: theirs.id, ownerName: 'Ana', isMine: false }),
        expect.objectContaining({ id: mine.id, ownerName: 'Ana', isMine: true }),
      ])
    )
  })

  it('lists only your own recipes with scope mine', async () => {
    const mine = insertRecipe(user.id, { title: 'Scope soup' })
    shareInto(insertRecipe(friend.id, { title: 'Scope stew' }).id, home.id, friend.id)
    expect(await call('list_recipes', { q: 'Scope', scope: 'mine' })).toMatchObject({
      recipes: [{ id: mine.id }],
    })
  })

  it('lists only recipes shared into the group with scope group', async () => {
    insertRecipe(user.id, { title: 'Group soup' })
    const shared = insertRecipe(friend.id, { title: 'Group stew' })
    shareInto(shared.id, home.id, friend.id)
    expect(await call('list_recipes', { q: 'Group s', scope: 'group' })).toMatchObject({
      recipes: [{ id: shared.id }],
    })
  })

  it('looks up nutrition from Open Food Facts', async () => {
    vi.stubEnv('USDA_API_KEY', '')
    const fetch = vi.fn().mockResolvedValue(
      Response.json({
        hits: [
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
    expect(String(fetch.mock.calls[0][0])).toContain('q=oats')
    vi.unstubAllGlobals()
  })
})

describe('mcp group scoping', () => {
  it('lists the caller’s groups with role and member count', async () => {
    expect(await asCook.call('list_groups')).toEqual({
      groups: [
        { id: kitchen.id, name: 'Kitchen', role: 'admin', memberCount: 1 },
        { id: cabin.id, name: 'Cabin', role: 'admin', memberCount: 2 },
      ],
    })
  })

  it('asks for a groupId listing the groups when the caller has several', async () => {
    expect(await asCook.callError('get_shopping_list')).toEqual([
      {
        type: 'text',
        text: `You are in several groups; pass groupId. Groups: Kitchen (${kitchen.id}), Cabin (${cabin.id})`,
      },
    ])
  })

  it('uses the given groupId when the caller is a member', async () => {
    await asCook.call('add_shopping_item', { groupId: cabin.id, name: 'Firewood' })
    expect(await asCook.call('get_shopping_list', { groupId: cabin.id })).toMatchObject({
      freeText: [{ name: 'Firewood' }],
    })
    expect(await asCook.call('get_shopping_list', { groupId: kitchen.id })).toMatchObject({
      freeText: [],
    })
  })

  it('refuses a groupId the caller is not a member of', async () => {
    expect(await asCook.callError('get_shopping_list', { groupId: home.id })).toEqual([
      { type: 'text', text: 'Not a member of that group' },
    ])
  })

  it('refuses to add to another group’s shopping list', async () => {
    await asCook.callError('add_shopping_item', { groupId: home.id, name: 'Intruder' })
    expect(itemIds(eq(schema.shoppingItem.name, 'Intruder'))).toEqual([])
  })

  it('refuses to add a meal to another group’s plan', async () => {
    const recipeId = insertRecipe(cook.id).id
    await asCook.callError('add_meal', {
      groupId: home.id,
      date: '2026-10-12',
      slot: 'dinner',
      recipeId,
    })
    expect(
      db.select().from(schema.mealPlanEntry).where(eq(schema.mealPlanEntry.groupId, home.id)).all()
    ).toEqual([])
  })

  it('refuses to remove another group’s meal plan entry', async () => {
    const { id } = await call('add_meal', { date: '2026-10-12', slot: 'lunch', note: 'Leftovers' })
    expect(await asCook.callError('remove_meal', { groupId: kitchen.id, id })).toEqual([
      { type: 'text', text: 'Entry not found' },
    ])
    await call('remove_meal', { id })
  })

  it('lists my recipes with scope mine without asking for a group', async () => {
    const own = insertRecipe(cook.id, { title: 'Cook’s curry' })
    expect(await asCook.call('list_recipes', { q: 'curry', scope: 'mine' })).toMatchObject({
      recipes: [{ id: own.id, isMine: true }],
    })
  })

  it('shares a recipe into a group and lists the share', async () => {
    const recipeId = insertRecipe(cook.id).id
    expect(await asCook.call('share_recipe', { recipeId, groupId: cabin.id })).toEqual({})
    expect(await asCook.call('list_recipe_shares', { recipeId })).toEqual({
      groups: [{ groupId: cabin.id, name: 'Cabin' }],
    })
  })

  it('unshares a recipe from a group', async () => {
    const recipeId = insertRecipe(cook.id).id
    shareInto(recipeId, cabin.id, cook.id)
    expect(await asCook.call('unshare_recipe', { recipeId, groupId: cabin.id })).toEqual({})
    expect(await asCook.call('list_recipe_shares', { recipeId })).toEqual({ groups: [] })
  })

  it('refuses to list the shares of someone else’s recipe', async () => {
    const recipeId = insertRecipe(friend.id).id
    shareInto(recipeId, cabin.id, friend.id)
    expect(await asCook.callError('list_recipe_shares', { recipeId })).toEqual([
      { type: 'text', text: 'Only the owner can delete or share this recipe' },
    ])
  })

  it('copies a shared recipe into a new recipe of your own', async () => {
    const source = insertRecipe(friend.id, { title: 'Cabin chili' })
    shareInto(source.id, cabin.id, friend.id)
    const id = await asCook.create('copy_recipe', { recipeId: source.id })
    expect(id).not.toBe(source.id)
    const { recipes } = await asCook.call('list_recipes', { groupId: cabin.id, q: 'Cabin chili' })
    expect(recipes).toHaveLength(2)
    expect(recipes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id, isMine: true }),
        expect.objectContaining({ id: source.id, isMine: false }),
      ])
    )
  })

  it('creates a group with the caller as admin', async () => {
    const asNewcomer = await connect(insertUser().id)
    const { id } = await asNewcomer.call('create_group', { name: 'Allotment' })
    expect(await asNewcomer.call('list_groups')).toEqual({
      groups: [{ id, name: 'Allotment', role: 'admin', memberCount: 1 }],
    })
  })

  it('creates an invite link under BETTER_AUTH_URL', async () => {
    const { url } = await asCook.call('create_invite_link', { groupId: kitchen.id })
    expect(url).toMatch(/^http:\/\/localhost:3000\/join\/[\w-]+$/)
  })

  it('leaves a group', async () => {
    const asLeaver = await connect(insertUser().id)
    const { id } = await asLeaver.call('create_group', { name: 'Temporary' })
    await asLeaver.call('create_group', { name: 'Staying' })
    expect(await asLeaver.call('leave_group', { groupId: id })).toEqual({})
    expect(await asLeaver.call('list_groups')).toMatchObject({ groups: [{ name: 'Staying' }] })
  })

  it('runs the meal plan flow from planning to the shopping list', async () => {
    const groupId = kitchen.id
    const ingredientId = await asCook.create('create_ingredient', { ...oatsInput, units: [] })
    const recipeId = await asCook.create('create_recipe', {
      title: 'Plan porridge',
      servings: 2,
      ingredients: [{ ingredientId, quantity: 100, unit: 'g' }],
      steps: [],
    })

    const id = await asCook.create('add_meal', {
      groupId,
      date: '2026-10-14',
      slot: 'breakfast',
      recipeId,
    })
    const week = await asCook.call('get_week_plan', { groupId, date: '2026-10-18' })
    expect(week).toMatchObject({ weekStart: '2026-10-12' })
    expect(week.days).toMatchObject([
      {},
      {},
      {
        date: '2026-10-14',
        slots: [
          { slot: 'breakfast', entries: [{ id, kind: 'recipe', recipe: { id: recipeId } }] },
          { slot: 'lunch', entries: [] },
          { slot: 'dinner', entries: [] },
          { slot: 'snack', entries: [] },
        ],
      },
      {},
      {},
      {},
      {},
    ])

    await asCook.call('move_meal', { groupId, id, date: '2026-10-15', slot: 'dinner' })
    await asCook.call('update_meal', { groupId, id, servings: 6 })
    expect(await asCook.call('get_week_plan', { groupId, date: '2026-10-12' })).toMatchObject({
      days: [
        {},
        {},
        { slots: [{ entries: [] }, { entries: [] }, { entries: [] }, { entries: [] }] },
        { date: '2026-10-15', slots: [{}, {}, { entries: [{ id, servings: 6 }] }, {}] },
        {},
        {},
        {},
      ],
    })

    expect(await asCook.call('add_week_to_shopping_list', { groupId, date: '2026-10-15' })).toEqual(
      { added: 1, skipped: 0 }
    )
    expect(await asCook.call('get_shopping_list', { groupId })).toMatchObject({
      needs: [{ ingredientId, neededGrams: 300, toBuyGrams: 300 }],
    })

    expect(await asCook.call('remove_meal', { groupId, id })).toEqual({})
    expect(await asCook.call('get_month_plan', { groupId, month: '2026-10' })).toMatchObject({
      month: '2026-10',
      days: expect.not.arrayContaining([expect.objectContaining({ count: 1 })]),
    })
  })

  it('defaults get_week_plan to the current week', async () => {
    const asSolo = await connect(insertUser().id)
    const { weekStart } = await asSolo.call('get_week_plan')
    expect(weekStart).toBe(mondayOf(localDate(new Date())))
  })

  it('refuses update_meal with nothing to change', async () => {
    expect(await asCook.callError('update_meal', { groupId: kitchen.id, id: 'x' })).toEqual([
      { type: 'text', text: 'Nothing to change' },
    ])
  })
})
