import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import { addRecipeSchema, pantryItemSchema, shoppingItemSchema } from './shopping'

function firstError(schema: z.ZodType, value: unknown) {
  const result = schema.safeParse(value)
  return result.success ? undefined : result.error.issues[0].message
}

describe('addRecipeSchema', () => {
  it('accepts a recipe id with whole servings', () => {
    expect(addRecipeSchema.parse({ recipeId: 'r1', servings: 4 })).toEqual({
      recipeId: 'r1',
      servings: 4,
    })
  })

  it('requires a recipe id', () => {
    expect(firstError(addRecipeSchema, { recipeId: '', servings: 2 })).toBe('Pick a recipe')
  })

  it('rejects zero servings', () => {
    expect(firstError(addRecipeSchema, { recipeId: 'r1', servings: 0 })).toBe(
      'Servings must be at least 1'
    )
  })

  it('rejects negative servings', () => {
    expect(firstError(addRecipeSchema, { recipeId: 'r1', servings: -2 })).toBe(
      'Servings must be at least 1'
    )
  })

  it('rejects fractional servings', () => {
    expect(firstError(addRecipeSchema, { recipeId: 'r1', servings: 1.5 })).toBe(
      'Servings must be a whole number'
    )
  })
})

describe('shoppingItemSchema', () => {
  it('accepts a name on its own and fills the rest with null', () => {
    expect(shoppingItemSchema.parse({ name: 'Milk' })).toEqual({
      name: 'Milk',
      quantity: null,
      unit: null,
      ingredientId: null,
    })
  })

  it('trims the name', () => {
    expect(shoppingItemSchema.parse({ name: '  Milk ' }).name).toBe('Milk')
  })

  it('requires a non-blank name', () => {
    expect(firstError(shoppingItemSchema, { name: '   ' })).toBe('Name is required')
  })

  it('accepts a quantity and unit', () => {
    expect(shoppingItemSchema.parse({ name: 'Milk', quantity: 2, unit: 'l' })).toMatchObject({
      quantity: 2,
      unit: 'l',
    })
  })

  it('rejects a zero quantity', () => {
    expect(firstError(shoppingItemSchema, { name: 'Milk', quantity: 0 })).toBe(
      'Quantity must be > 0'
    )
  })

  it('rejects a negative quantity', () => {
    expect(firstError(shoppingItemSchema, { name: 'Milk', quantity: -1 })).toBe(
      'Quantity must be > 0'
    )
  })

  it('turns a blank unit into null', () => {
    expect(shoppingItemSchema.parse({ name: 'Milk', unit: '  ' }).unit).toBeNull()
  })

  it('trims the unit', () => {
    expect(shoppingItemSchema.parse({ name: 'Milk', unit: ' carton ' }).unit).toBe('carton')
  })

  it('keeps a linked ingredient id', () => {
    expect(shoppingItemSchema.parse({ name: 'Oats', ingredientId: 'oats' }).ingredientId).toBe(
      'oats'
    )
  })
})

describe('pantryItemSchema', () => {
  it('accepts an amount in grams', () => {
    expect(pantryItemSchema.parse({ ingredientId: 'oats', grams: 250 })).toEqual({
      ingredientId: 'oats',
      grams: 250,
    })
  })

  it('accepts an unknown amount', () => {
    expect(pantryItemSchema.parse({ ingredientId: 'oats', grams: null }).grams).toBeNull()
  })

  it('requires an ingredient', () => {
    expect(firstError(pantryItemSchema, { ingredientId: '', grams: 1 })).toBe('Pick an ingredient')
  })

  it('rejects a zero amount', () => {
    expect(firstError(pantryItemSchema, { ingredientId: 'oats', grams: 0 })).toBe(
      'Amount must be > 0'
    )
  })

  it('rejects a negative amount', () => {
    expect(firstError(pantryItemSchema, { ingredientId: 'oats', grams: -5 })).toBe(
      'Amount must be > 0'
    )
  })

  it('rejects a non-numeric amount', () => {
    expect(firstError(pantryItemSchema, { ingredientId: 'oats', grams: Number.NaN })).toBe(
      'Amount must be a number'
    )
  })
})
