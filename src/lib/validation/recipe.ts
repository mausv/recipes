import { z } from 'zod'

const optionalText = z
  .string()
  .trim()
  .nullable()
  .transform((v) => v || null)

export const recipeIngredientSchema = z.object({
  ingredientId: z.string().min(1, 'Pick an ingredient for every line'),
  quantity: z.number('Quantity must be a number').positive('Quantity must be > 0'),
  unit: z.string().min(1, 'Pick a unit for every line'),
  groupName: optionalText,
})

export const recipeStepSchema = z.object({
  text: z.string().trim().min(1, 'Steps cannot be empty'),
  imageId: z.string().nullable(),
})

export const recipeSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  description: optionalText,
  servings: z.int('Servings must be a whole number').positive('Servings must be at least 1'),
  cookedWeightGrams: z
    .number('Cooked weight must be a number')
    .positive('Cooked weight must be > 0')
    .nullable(),
  tags: z
    .array(z.string().trim().toLowerCase())
    .transform((tags) => [...new Set(tags.filter(Boolean))]),
  coverImageId: z.string().nullable(),
  ingredients: z.array(recipeIngredientSchema),
  steps: z.array(recipeStepSchema),
})

export type RecipeInput = z.input<typeof recipeSchema>
export type RecipeData = z.output<typeof recipeSchema>
