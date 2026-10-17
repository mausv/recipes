import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { version } from '../../package.json'
import { addComment, listComments } from '@/lib/comments'
import {
  createIngredient,
  deleteIngredient,
  getIngredient,
  listIngredients,
  updateIngredient,
} from '@/lib/ingredients'
import { createGroup, createInvite, defaultGroup, leaveGroup, listGroups } from '@/lib/groups'
import {
  addEntry,
  getMonth,
  getWeek,
  localDate,
  mondayOf,
  moveEntry,
  removeEntry,
  updateEntry,
} from '@/lib/meal-plan'
import { getNote, saveNote } from '@/lib/notes'
import { searchNutrition } from '@/lib/nutrition-sources'
import {
  copyRecipe,
  createRecipe,
  deleteRecipe,
  getRecipeWithNutrition,
  listRecipeShares,
  listRecipes,
  listTags,
  ownerError,
  shareRecipe,
  unshareRecipe,
  updateRecipe,
} from '@/lib/recipes'
import {
  addRecipeToShoppingList,
  addShoppingItem,
  addWeekToShoppingList,
  clearCheckedItems,
  clearShoppingList,
  getShoppingList,
  moveBoughtToPantry,
  removePantryItem,
  removeShoppingItems,
  setPantryItem,
  setShoppingItemsChecked,
} from '@/lib/shopping-list'
import { commentSchema } from '@/lib/validation/comment'
import { groupSchema } from '@/lib/validation/group'
import { ingredientSchema } from '@/lib/validation/ingredient'
import {
  addEntrySchema,
  dateSchema,
  monthSchema,
  moveEntrySchema,
  updateEntrySchema,
} from '@/lib/validation/meal-plan'
import { noteSchema } from '@/lib/validation/note'
import { recipeIngredientSchema, recipeSchema, recipeStepSchema } from '@/lib/validation/recipe'
import { addRecipeSchema, pantryItemSchema, shoppingItemSchema } from '@/lib/validation/shopping'

const INSTRUCTIONS = `Recipe library with nutrition, groups, a meal plan, a shopping list and a pantry.
- Recipes are personal: you see your own recipes and those shared into your groups, and can only change your own. share_recipe shares one of yours into a group; copy_recipe makes your own editable copy of any recipe you can see.
- Groups (households) own the meal plan, shopping list and pantry. A user can be in several groups. Group-scoped tools take an optional groupId: it can be omitted when the user has one group; with several, call list_groups first and ask which one to use.
- Meal plan dates are YYYY-MM-DD; weeks start on Monday. Slots: breakfast, lunch, dinner, snack. An entry is a recipe (with optional servings, default the recipe's) or a free-text note.
- Ingredients live in a shared library. Nutrition (kcal, protein, carbs, fat, fiber) is per 100 g. Density is g/ml (default 1). Ingredients can have custom units (e.g. "piece" = 50 g).
- Recipe ingredient lines reference a library ingredient by id with a quantity and a unit. Grams are resolved server-side.
- Built-in units: weight g, kg, oz, lb; volume ml, l, tsp, tbsp, cup, fl oz (converted to grams via the ingredient's density). An ingredient's custom units (matched case-insensitively) override a built-in of the same name, e.g. "cup" = 90 g for oats.
- To add a recipe with a new ingredient: search_ingredients first; if missing, lookup_nutrition and create_ingredient from a result, then create_recipe.
- The shopping list merges lines per ingredient and subtracts the pantry.`

const UNIT_DESCRIPTION =
  'g, kg, oz, lb, ml, l, tsp, tbsp, cup, fl oz, or one of the ingredient’s custom units (a custom unit overrides a built-in of the same name)'

const id = z.string().min(1)
const ids = z.array(id).min(1)
const groupId = id
  .optional()
  .describe('Group id from list_groups; optional when the user has one group')

const recipeInput = recipeSchema.extend({
  description: recipeSchema.shape.description.default(null),
  cookedWeightGrams: recipeSchema.shape.cookedWeightGrams.default(null),
  tags: recipeSchema.shape.tags.default([]),
  coverImageId: recipeSchema.shape.coverImageId.default(null),
  ingredients: z.array(
    recipeIngredientSchema.extend({
      unit: recipeIngredientSchema.shape.unit.describe(UNIT_DESCRIPTION),
      groupName: recipeIngredientSchema.shape.groupName.default(null),
    })
  ),
  steps: z.array(
    recipeStepSchema.extend({ imageId: recipeStepSchema.shape.imageId.default(null) })
  ),
})

const ingredientInput = ingredientSchema.extend({
  brand: ingredientSchema.shape.brand.default(null),
  fiber: ingredientSchema.shape.fiber.default(null),
  density: ingredientSchema.shape.density.default(1),
  source: ingredientSchema.shape.source.default('manual'),
  sourceId: ingredientSchema.shape.sourceId.default(null),
  units: ingredientSchema.shape.units.default([]),
})

function reply(result: Record<string, unknown>): CallToolResult {
  if (typeof result.error === 'string') {
    return { isError: true, content: [{ type: 'text', text: result.error }] }
  }
  return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result }
}

function notFound(what: string) {
  return reply({ error: `${what} not found` })
}

const read = { readOnlyHint: true }
const destructive = { destructiveHint: true }

function today() {
  return localDate(new Date())
}

export function createMcpServer(userId: string) {
  const server = new McpServer({ name: 'recipes', version }, { instructions: INSTRUCTIONS })

  function inGroup(groupId: string | undefined, run: (groupId: string) => CallToolResult) {
    const groups = listGroups(userId)
    if (groupId !== undefined) {
      return groups.some((g) => g.id === groupId)
        ? run(groupId)
        : reply({ error: 'Not a member of that group' })
    }
    if (groups.length > 1) {
      const names = groups.map((g) => `${g.name} (${g.id})`).join(', ')
      return reply({ error: `You are in several groups; pass groupId. Groups: ${names}` })
    }
    return run(defaultGroup(userId).id)
  }

  server.registerTool(
    'list_groups',
    {
      description: 'List your groups with your role and member count.',
      annotations: read,
    },
    () => reply({ groups: listGroups(userId) })
  )

  server.registerTool(
    'create_group',
    { description: 'Create a group with you as its admin.', inputSchema: groupSchema },
    ({ name }) => {
      const created = createGroup(userId, name)
      return reply({ id: created.id, name: created.name })
    }
  )

  server.registerTool(
    'create_invite_link',
    {
      description:
        'Create a 7-day invite link to a group (admins only). Anyone with an account who opens it joins the group.',
      inputSchema: { groupId: id },
    },
    ({ groupId }) =>
      inGroup(groupId, () => {
        const result = createInvite(groupId, userId)
        if ('error' in result) return reply(result)
        return reply({
          url: new URL(`/join/${result.token}`, process.env.BETTER_AUTH_URL).href,
          expiresAt: result.expiresAt.toISOString(),
        })
      })
  )

  server.registerTool(
    'leave_group',
    {
      description: 'Leave a group. Leaving as its last member deletes the group and its data.',
      inputSchema: { groupId: id },
      annotations: destructive,
    },
    ({ groupId }) => reply(leaveGroup(userId, groupId))
  )

  server.registerTool(
    'list_recipes',
    {
      description:
        'List recipes, newest first. q matches title or tags; tag filters by exact tag. scope: all (yours and those shared into the group, default), mine, or group (shared into the group). mine needs no group.',
      inputSchema: {
        q: z.string().optional(),
        tag: z.string().optional(),
        scope: z.enum(['all', 'mine', 'group']).default('all'),
        groupId,
      },
      annotations: read,
    },
    ({ groupId, scope, ...filters }) => {
      const list = (groupId: string) =>
        reply({
          recipes: listRecipes({ ...filters, scope, userId, groupId }).map(
            ({ createdById, ...recipe }) => ({ ...recipe, isMine: createdById === userId })
          ),
        })
      return scope === 'mine' ? list(defaultGroup(userId).id) : inGroup(groupId, list)
    }
  )

  server.registerTool(
    'get_recipe',
    {
      description:
        'Get a recipe with ingredient lines, steps, nutrition (total, per serving, per 100 g, per ingredient), comments and your private note.',
      inputSchema: { id },
      annotations: read,
    },
    async ({ id }) => {
      const recipe = await getRecipeWithNutrition(id, userId)
      if (!recipe) return notFound('Recipe')
      return reply({
        id: recipe.id,
        title: recipe.title,
        description: recipe.description,
        servings: recipe.servings,
        cookedWeightGrams: recipe.cookedWeightGrams,
        tags: recipe.tags,
        coverImageId: recipe.coverImageId,
        createdBy: recipe.createdBy.name,
        ingredients: recipe.ingredients.map((line) => ({
          ingredientId: line.ingredientId,
          name: line.ingredient.name,
          quantity: line.quantity,
          unit: line.unit,
          grams: line.grams,
          groupName: line.groupName,
        })),
        steps: recipe.steps.map((step) => ({ text: step.text, imageId: step.imageId })),
        nutrition: {
          ...recipe.nutrition,
          perIngredient: recipe.ingredients.map((line) => ({
            ingredientId: line.ingredientId,
            name: line.ingredient.name,
            grams: line.grams,
            ...line.macros,
          })),
        },
        comments: listComments(userId, id).map((c) => ({
          author: c.user.name,
          text: c.text,
          createdAt: c.createdAt.toISOString(),
        })),
        note: getNote(userId, id)?.text ?? null,
      })
    }
  )

  server.registerTool(
    'create_recipe',
    {
      description:
        'Create a recipe. Ingredient lines need a library ingredientId, a quantity and a unit (built-in or one of the ingredient’s custom units).',
      inputSchema: recipeInput,
    },
    (input) => reply(createRecipe(userId, input))
  )

  server.registerTool(
    'update_recipe',
    {
      description:
        'Replace a recipe’s fields, ingredient lines and steps. Omit coverImageId to keep the current cover; pass each step’s imageId from get_recipe to keep step photos.',
      inputSchema: recipeInput.extend({ id, coverImageId: z.string().nullable().optional() }),
      annotations: destructive,
    },
    async ({ id, coverImageId, ...input }) => {
      const current = await getRecipeWithNutrition(id, userId)
      if (!current) return notFound('Recipe')
      return reply(
        await updateRecipe(id, userId, {
          ...input,
          coverImageId: coverImageId === undefined ? current.coverImageId : coverImageId,
        })
      )
    }
  )

  server.registerTool(
    'delete_recipe',
    {
      description: 'Delete a recipe and its photos.',
      inputSchema: { id },
      annotations: destructive,
    },
    async ({ id }) => reply(await deleteRecipe(id, userId))
  )

  server.registerTool(
    'share_recipe',
    {
      description: 'Share one of your recipes into a group you belong to.',
      inputSchema: { recipeId: id, groupId: id },
    },
    ({ recipeId, groupId }) => reply(shareRecipe(recipeId, groupId, userId))
  )

  server.registerTool(
    'unshare_recipe',
    {
      description: 'Stop sharing one of your recipes with a group.',
      inputSchema: { recipeId: id, groupId: id },
      annotations: destructive,
    },
    ({ recipeId, groupId }) => reply(unshareRecipe(recipeId, groupId, userId))
  )

  server.registerTool(
    'list_recipe_shares',
    {
      description: 'List the groups one of your recipes is shared into.',
      inputSchema: { recipeId: id },
      annotations: read,
    },
    ({ recipeId }) => {
      const error = ownerError(userId, recipeId)
      return reply(error ? { error } : { groups: listRecipeShares(recipeId) })
    }
  )

  server.registerTool(
    'copy_recipe',
    {
      description:
        'Copy a recipe you can see (with photos) into a new recipe of your own, not shared with any group.',
      inputSchema: { recipeId: id },
    },
    async ({ recipeId }) => reply(await copyRecipe(recipeId, userId))
  )

  server.registerTool(
    'search_ingredients',
    {
      description: 'Search the ingredient library by name or brand. Macros are per 100 g.',
      inputSchema: { q: z.string() },
      annotations: read,
    },
    ({ q }) => reply({ ingredients: listIngredients(q) })
  )

  server.registerTool(
    'get_ingredient',
    {
      description: 'Get a library ingredient with its per-100 g macros, density and custom units.',
      inputSchema: { id },
      annotations: read,
    },
    ({ id }) => {
      const ingredient = getIngredient(id)
      return ingredient ? reply(ingredient) : notFound('Ingredient')
    }
  )

  server.registerTool(
    'create_ingredient',
    {
      description:
        'Add an ingredient to the library. Macros are per 100 g, density is g/ml, units are custom units with their weight in grams. Use source and sourceId when creating from lookup_nutrition.',
      inputSchema: ingredientInput,
    },
    (input) => reply(createIngredient(userId, input))
  )

  server.registerTool(
    'update_ingredient',
    {
      description:
        'Replace a library ingredient’s fields and custom units. Recipe grams are recalculated.',
      inputSchema: ingredientInput.extend({ id }),
      annotations: destructive,
    },
    ({ id, ...input }) => reply(updateIngredient(id, input))
  )

  server.registerTool(
    'delete_ingredient',
    {
      description: 'Delete a library ingredient. Fails while a recipe uses it.',
      inputSchema: { id },
      annotations: destructive,
    },
    ({ id }) => reply(deleteIngredient(id))
  )

  server.registerTool(
    'lookup_nutrition',
    {
      description:
        'Search Open Food Facts (and USDA when configured) for per-100 g nutrition to create ingredients from.',
      inputSchema: { q: z.string().trim().min(1) },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ q }) => reply({ results: await searchNutrition(q) })
  )

  server.registerTool(
    'get_shopping_list',
    {
      description:
        'Get the group shopping list: needs merged per ingredient with the pantry applied (toBuyGrams), free-text items, and the pantry.',
      inputSchema: { groupId },
      annotations: read,
    },
    ({ groupId }) => inGroup(groupId, (groupId) => reply(getShoppingList(groupId)))
  )

  server.registerTool(
    'add_recipe_to_shopping_list',
    {
      description: 'Add a recipe’s ingredients to the shopping list, scaled to the given servings.',
      inputSchema: addRecipeSchema.extend({ groupId }),
    },
    ({ groupId, recipeId, servings }) =>
      inGroup(groupId, (groupId) =>
        reply(addRecipeToShoppingList(groupId, userId, recipeId, servings))
      )
  )

  server.registerTool(
    'add_shopping_item',
    {
      description:
        'Add an item to the shopping list. Link ingredientId to merge it with recipe needs; otherwise it is free text.',
      inputSchema: shoppingItemSchema.extend({
        unit: shoppingItemSchema.shape.unit.describe(
          `${UNIT_DESCRIPTION}. Grams are resolved only for a linked ingredient; otherwise any text.`
        ),
        groupId,
      }),
    },
    ({ groupId, ...input }) => inGroup(groupId, (groupId) => reply(addShoppingItem(groupId, input)))
  )

  server.registerTool(
    'check_shopping_items',
    {
      description: 'Check or uncheck shopping list items by item id.',
      inputSchema: { ids, checked: z.boolean(), groupId },
    },
    ({ ids, checked, groupId }) =>
      inGroup(groupId, (groupId) => {
        setShoppingItemsChecked(groupId, ids, checked)
        return reply({ ok: true })
      })
  )

  server.registerTool(
    'remove_shopping_items',
    {
      description: 'Remove shopping list items by item id.',
      inputSchema: { ids, groupId },
      annotations: destructive,
    },
    ({ ids, groupId }) =>
      inGroup(groupId, (groupId) => {
        removeShoppingItems(groupId, ids)
        return reply({ ok: true })
      })
  )

  server.registerTool(
    'clear_checked_items',
    {
      description: 'Remove all checked items from the shopping list.',
      inputSchema: { groupId },
      annotations: destructive,
    },
    ({ groupId }) =>
      inGroup(groupId, (groupId) => {
        clearCheckedItems(groupId)
        return reply({ ok: true })
      })
  )

  server.registerTool(
    'move_bought_to_pantry',
    {
      description:
        'Move checked ingredient items into the pantry (adding their grams) and remove them from the list.',
      inputSchema: { groupId },
    },
    ({ groupId }) => inGroup(groupId, (groupId) => reply(moveBoughtToPantry(groupId)))
  )

  server.registerTool(
    'clear_shopping_list',
    {
      description: 'Remove every item from the shopping list.',
      inputSchema: { groupId },
      annotations: destructive,
    },
    ({ groupId }) =>
      inGroup(groupId, (groupId) => {
        clearShoppingList(groupId)
        return reply({ ok: true })
      })
  )

  server.registerTool(
    'set_pantry_item',
    {
      description:
        'Set how many grams of an ingredient are in the pantry; null means an unknown amount.',
      inputSchema: pantryItemSchema.extend({ groupId }),
    },
    ({ groupId, ...input }) => inGroup(groupId, (groupId) => reply(setPantryItem(groupId, input)))
  )

  server.registerTool(
    'remove_pantry_item',
    {
      description: 'Remove an ingredient from the pantry.',
      inputSchema: { ingredientId: id, groupId },
      annotations: destructive,
    },
    ({ ingredientId, groupId }) =>
      inGroup(groupId, (groupId) => {
        removePantryItem(groupId, ingredientId)
        return reply({ ok: true })
      })
  )

  server.registerTool(
    'add_comment',
    {
      description: 'Post a comment on a recipe, visible to everyone who can see the recipe.',
      inputSchema: commentSchema,
    },
    ({ recipeId, text }) => reply(addComment(userId, recipeId, text))
  )

  server.registerTool(
    'save_note',
    {
      description: 'Save your private note on a recipe. An empty text deletes it.',
      inputSchema: noteSchema,
    },
    ({ recipeId, text }) => reply(saveNote(userId, recipeId, text))
  )

  server.registerTool(
    'list_tags',
    {
      description: 'List the tags of your recipes and those shared into the group.',
      inputSchema: { groupId },
      annotations: read,
    },
    ({ groupId }) => inGroup(groupId, (groupId) => reply({ tags: listTags({ userId, groupId }) }))
  )

  server.registerTool(
    'get_week_plan',
    {
      description:
        'Get the meal plan for the Monday-to-Sunday week containing date (default today): each day with its slots and entries.',
      inputSchema: { groupId, date: dateSchema.optional() },
      annotations: read,
    },
    ({ groupId, date = today() }) =>
      inGroup(groupId, (groupId) => {
        const weekStart = mondayOf(date)
        return reply({ weekStart, days: getWeek(groupId, userId, weekStart) })
      })
  )

  server.registerTool(
    'get_month_plan',
    {
      description:
        'Get a month overview (YYYY-MM, default this month): every day of the weeks touching it with its entry count and up to two titles.',
      inputSchema: { groupId, month: monthSchema.optional() },
      annotations: read,
    },
    ({ groupId, month = today().slice(0, 7) }) =>
      inGroup(groupId, (groupId) => reply({ month, days: getMonth(groupId, userId, month) }))
  )

  server.registerTool(
    'add_meal',
    {
      description:
        'Add a meal plan entry: a recipe (servings default to the recipe’s) or a free-text note, not both.',
      inputSchema: { groupId, ...addEntrySchema.shape },
    },
    ({ groupId, ...entry }) =>
      inGroup(groupId, (groupId) => reply(addEntry(groupId, userId, entry)))
  )

  server.registerTool(
    'update_meal',
    {
      description:
        'Change a meal plan entry: servings for a recipe entry (null resets to the recipe’s), or the text of a note.',
      inputSchema: { groupId, id, ...updateEntrySchema.shape },
    },
    ({ groupId, id, ...changes }) => {
      if (changes.servings === undefined && changes.note === undefined) {
        return reply({ error: 'Nothing to change' })
      }
      return inGroup(groupId, (groupId) => reply(updateEntry(groupId, userId, id, changes)))
    }
  )

  server.registerTool(
    'move_meal',
    {
      description: 'Move a meal plan entry to another date and slot.',
      inputSchema: { groupId, id, ...moveEntrySchema.shape },
    },
    ({ groupId, id, ...to }) =>
      inGroup(groupId, (groupId) => reply(moveEntry(groupId, userId, id, to)))
  )

  server.registerTool(
    'remove_meal',
    {
      description: 'Remove a meal plan entry.',
      inputSchema: { groupId, id },
      annotations: destructive,
    },
    ({ groupId, id }) => inGroup(groupId, (groupId) => reply(removeEntry(groupId, userId, id)))
  )

  server.registerTool(
    'add_week_to_shopping_list',
    {
      description:
        'Add every recipe planned in the week containing date (default today) to the shopping list, scaled to each entry’s servings.',
      inputSchema: { groupId, date: dateSchema.optional() },
    },
    ({ groupId, date = today() }) =>
      inGroup(groupId, (groupId) => reply(addWeekToShoppingList(groupId, userId, mondayOf(date))))
  )

  return server
}
