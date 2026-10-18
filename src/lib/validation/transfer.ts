import { z } from 'zod'
import { recipeSchema } from './recipe'

const id = z.string().min(1)
const amount = z.number().min(0)
const imageId = z.uuid('Invalid image id')

const exportIngredientSchema = z.object({
  id,
  name: z.string().trim().min(1),
  brand: z.string().nullable(),
  category: z.string().nullable().default(null),
  kcal: amount,
  protein: amount,
  carbs: amount,
  fat: amount,
  fiber: amount.nullable(),
  density: z.number().positive(),
  source: z.enum(['manual', 'off', 'usda']),
  sourceId: z.string().nullable(),
  units: z.array(z.object({ name: z.string().min(1), grams: z.number().positive() })),
})

const exportRecipeSchema = z.object({
  id,
  title: z.string().trim().min(1),
  description: z.string().nullable(),
  servings: z.int().positive(),
  cookedWeightGrams: z.number().positive().nullable(),
  tags: recipeSchema.shape.tags,
  coverImageId: imageId.nullable(),
  ingredients: z.array(
    z.object({
      ingredientId: id,
      quantity: z.number().positive(),
      unit: z.string().min(1),
      grams: amount,
      groupName: z.string().nullable(),
      position: z.int().min(0),
    })
  ),
  steps: z.array(
    z.object({ text: z.string().min(1), imageId: imageId.nullable(), position: z.int().min(0) })
  ),
  comments: z.array(
    z.object({ authorName: z.string(), text: z.string().min(1), createdAt: z.iso.datetime() })
  ),
  notes: z.array(
    z.object({ authorName: z.string(), text: z.string().min(1), updatedAt: z.iso.datetime() })
  ),
})

const exportImageSchema = z.object({
  id: imageId,
  width: z.int().positive(),
  height: z.int().positive(),
  data: z.base64(),
})

export const exportSchema = z.object({
  version: z.literal(1, { error: 'Unsupported export version, expected version 1' }),
  exportedAt: z.iso.datetime(),
  ingredients: z.array(exportIngredientSchema),
  recipes: z.array(exportRecipeSchema),
  images: z.array(exportImageSchema).optional(),
})

export const importModeSchema = z.enum(['merge', 'replace'], { error: 'Choose merge or replace' })

export type ExportDoc = z.infer<typeof exportSchema>
export type ImportMode = z.infer<typeof importModeSchema>
