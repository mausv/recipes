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
import { getNote, saveNote } from '@/lib/notes'
import { searchNutrition } from '@/lib/nutrition-sources'
import {
  createRecipe,
  deleteRecipe,
  getRecipeWithNutrition,
  listRecipes,
  listTags,
  updateRecipe,
} from '@/lib/recipes'
import {
  addRecipeToShoppingList,
  addShoppingItem,
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
import { ingredientSchema } from '@/lib/validation/ingredient'
import { noteSchema } from '@/lib/validation/note'
import { recipeIngredientSchema, recipeSchema, recipeStepSchema } from '@/lib/validation/recipe'
import { addRecipeSchema, pantryItemSchema, shoppingItemSchema } from '@/lib/validation/shopping'

const INSTRUCTIONS = `Household recipe library with nutrition, a shared shopping list and a pantry.
- Ingredients live in a shared library. Nutrition (kcal, protein, carbs, fat, fiber) is per 100 g. Density is g/ml (default 1). Ingredients can have custom units (e.g. "piece" = 50 g).
- Recipe ingredient lines reference a library ingredient by id with a quantity and a unit: g, kg, ml, l, or one of that ingredient's custom units. Grams are resolved server-side.
- To add a recipe with a new ingredient: search_ingredients first; if missing, lookup_nutrition and create_ingredient from a result, then create_recipe.
- The shopping list merges lines per ingredient and subtracts the pantry.`

const id = z.string().min(1)
const ids = z.array(id).min(1)

const recipeInput = recipeSchema.extend({
  description: recipeSchema.shape.description.default(null),
  cookedWeightGrams: recipeSchema.shape.cookedWeightGrams.default(null),
  tags: recipeSchema.shape.tags.default([]),
  coverImageId: recipeSchema.shape.coverImageId.default(null),
  ingredients: z.array(
    recipeIngredientSchema.extend({
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

export function createMcpServer(userId: string) {
  const server = new McpServer({ name: 'recipes', version }, { instructions: INSTRUCTIONS })

  server.registerTool(
    'list_recipes',
    {
      description: 'List recipes, newest first. q matches title or tags; tag filters by exact tag.',
      inputSchema: { q: z.string().optional(), tag: z.string().optional() },
      annotations: read,
    },
    (filters) => reply({ recipes: listRecipes(filters) })
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
      const recipe = await getRecipeWithNutrition(id)
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
        comments: listComments(id).map((c) => ({
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
        'Create a recipe. Ingredient lines need a library ingredientId, a quantity and a unit (g, kg, ml, l or one of the ingredient’s custom units).',
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
      const current = await getRecipeWithNutrition(id)
      if (!current) return notFound('Recipe')
      return reply(
        await updateRecipe(id, {
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
    async ({ id }) => reply(await deleteRecipe(id))
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
        'Get the shared shopping list: needs merged per ingredient with the pantry applied (toBuyGrams), free-text items, and the pantry.',
      annotations: read,
    },
    () => reply(getShoppingList())
  )

  server.registerTool(
    'add_recipe_to_shopping_list',
    {
      description: 'Add a recipe’s ingredients to the shopping list, scaled to the given servings.',
      inputSchema: addRecipeSchema,
    },
    ({ recipeId, servings }) => reply(addRecipeToShoppingList(recipeId, servings))
  )

  server.registerTool(
    'add_shopping_item',
    {
      description:
        'Add an item to the shopping list. Link ingredientId to merge it with recipe needs; otherwise it is free text.',
      inputSchema: shoppingItemSchema,
    },
    (input) => reply(addShoppingItem(input))
  )

  server.registerTool(
    'check_shopping_items',
    {
      description: 'Check or uncheck shopping list items by item id.',
      inputSchema: { ids, checked: z.boolean() },
    },
    ({ ids, checked }) => {
      setShoppingItemsChecked(ids, checked)
      return reply({ ok: true })
    }
  )

  server.registerTool(
    'remove_shopping_items',
    {
      description: 'Remove shopping list items by item id.',
      inputSchema: { ids },
      annotations: destructive,
    },
    ({ ids }) => {
      removeShoppingItems(ids)
      return reply({ ok: true })
    }
  )

  server.registerTool(
    'clear_checked_items',
    { description: 'Remove all checked items from the shopping list.', annotations: destructive },
    () => {
      clearCheckedItems()
      return reply({ ok: true })
    }
  )

  server.registerTool(
    'move_bought_to_pantry',
    {
      description:
        'Move checked ingredient items into the pantry (adding their grams) and remove them from the list.',
    },
    () => reply(moveBoughtToPantry())
  )

  server.registerTool(
    'clear_shopping_list',
    { description: 'Remove every item from the shopping list.', annotations: destructive },
    () => {
      clearShoppingList()
      return reply({ ok: true })
    }
  )

  server.registerTool(
    'set_pantry_item',
    {
      description:
        'Set how many grams of an ingredient are in the pantry; null means an unknown amount.',
      inputSchema: pantryItemSchema,
    },
    (input) => reply(setPantryItem(input))
  )

  server.registerTool(
    'remove_pantry_item',
    {
      description: 'Remove an ingredient from the pantry.',
      inputSchema: { ingredientId: id },
      annotations: destructive,
    },
    ({ ingredientId }) => {
      removePantryItem(ingredientId)
      return reply({ ok: true })
    }
  )

  server.registerTool(
    'add_comment',
    {
      description: 'Post a comment on a recipe, visible to the household.',
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
    { description: 'List every recipe tag.', annotations: read },
    () => reply({ tags: listTags() })
  )

  return server
}
