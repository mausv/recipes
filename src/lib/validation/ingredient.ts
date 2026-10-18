import { z } from 'zod'

const optionalText = z
  .string()
  .trim()
  .nullable()
  .transform((v) => v || null)

const macro = (label: string) =>
  z.number(`${label} must be a number`).min(0, `${label} must be ≥ 0`)

const reservedUnits = ['g', 'kg', 'ml', 'l']

export const ingredientUnitSchema = z.object({
  name: z.string().trim().min(1, 'Unit name is required'),
  grams: z.number('Unit grams must be a number').positive('Unit grams must be > 0'),
})

export const ingredientSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  brand: optionalText,
  category: optionalText,
  kcal: macro('Calories'),
  protein: macro('Protein'),
  carbs: macro('Carbs'),
  fat: macro('Fat'),
  fiber: macro('Fiber').nullable(),
  density: z.number('Density must be a number').positive('Density must be > 0'),
  source: z.enum(['manual', 'off', 'usda']),
  sourceId: z.string().nullable(),
  units: z
    .array(ingredientUnitSchema)
    .refine((units) => units.every((u) => !reservedUnits.includes(u.name.toLowerCase())), {
      message: `Custom units cannot be named ${reservedUnits.join(', ')}`,
    })
    .refine((units) => new Set(units.map((u) => u.name.toLowerCase())).size === units.length, {
      message: 'Custom unit names must be unique',
    }),
})

export type IngredientInput = z.input<typeof ingredientSchema>
export type IngredientData = z.output<typeof ingredientSchema>
