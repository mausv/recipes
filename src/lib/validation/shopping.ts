import { z } from 'zod'

export const addRecipeSchema = z.object({
  recipeId: z.string().min(1, 'Pick a recipe'),
  servings: z.int('Servings must be a whole number').positive('Servings must be at least 1'),
})

export const shoppingItemSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  quantity: z
    .number('Quantity must be a number')
    .positive('Quantity must be > 0')
    .nullable()
    .default(null),
  unit: z
    .string()
    .trim()
    .nullable()
    .default(null)
    .transform((v) => v || null),
  ingredientId: z.string().min(1).nullable().default(null),
})

export const pantryItemSchema = z.object({
  ingredientId: z.string().min(1, 'Pick an ingredient'),
  grams: z.number('Amount must be a number').positive('Amount must be > 0').nullable(),
})

export type AddRecipeInput = z.input<typeof addRecipeSchema>
export type ShoppingItemInput = z.input<typeof shoppingItemSchema>
export type PantryItemInput = z.input<typeof pantryItemSchema>
export type ShoppingItemData = z.output<typeof shoppingItemSchema>
export type PantryItemData = z.output<typeof pantryItemSchema>
