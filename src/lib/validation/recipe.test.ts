import { describe, expect, it } from 'vitest'
import { type RecipeInput, recipeSchema } from './recipe'

const porridge: RecipeInput = {
  title: 'Porridge',
  description: null,
  servings: 2,
  cookedWeightGrams: null,
  tags: [],
  coverImageId: null,
  ingredients: [{ ingredientId: 'oats', quantity: 80, unit: 'g', groupName: null }],
  steps: [{ text: 'Simmer', imageId: null }],
}

function firstError(input: RecipeInput) {
  const result = recipeSchema.safeParse(input)
  return result.success ? undefined : result.error.issues[0].message
}

describe('recipeSchema', () => {
  it('accepts a complete recipe', () => {
    expect(recipeSchema.safeParse(porridge).success).toBe(true)
  })

  it('accepts a recipe without ingredients or steps', () => {
    expect(recipeSchema.safeParse({ ...porridge, ingredients: [], steps: [] }).success).toBe(true)
  })

  it('requires a non-blank title', () => {
    expect(firstError({ ...porridge, title: ' ' })).toBe('Title is required')
  })

  it('turns a blank description into null', () => {
    expect(recipeSchema.parse({ ...porridge, description: '' }).description).toBeNull()
  })

  it('rejects fractional servings', () => {
    expect(firstError({ ...porridge, servings: 1.5 })).toBe('Servings must be a whole number')
  })

  it('rejects zero servings', () => {
    expect(firstError({ ...porridge, servings: 0 })).toBe('Servings must be at least 1')
  })

  it('rejects a zero cooked weight', () => {
    expect(firstError({ ...porridge, cookedWeightGrams: 0 })).toBe('Cooked weight must be > 0')
  })

  it('normalises tags to trimmed lowercase', () => {
    expect(recipeSchema.parse({ ...porridge, tags: [' Breakfast '] }).tags).toEqual(['breakfast'])
  })

  it('drops blank and duplicate tags', () => {
    const { tags } = recipeSchema.parse({ ...porridge, tags: ['quick', '', 'Quick', 'vegan'] })
    expect(tags).toEqual(['quick', 'vegan'])
  })

  it('requires every ingredient line to have an ingredient', () => {
    const ingredients = [{ ingredientId: '', quantity: 1, unit: 'g', groupName: null }]
    expect(firstError({ ...porridge, ingredients })).toBe('Pick an ingredient for every line')
  })

  it('rejects a zero quantity', () => {
    const ingredients = [{ ingredientId: 'oats', quantity: 0, unit: 'g', groupName: null }]
    expect(firstError({ ...porridge, ingredients })).toBe('Quantity must be > 0')
  })

  it('turns a blank group name into null', () => {
    const ingredients = [{ ingredientId: 'oats', quantity: 1, unit: 'g', groupName: ' ' }]
    expect(recipeSchema.parse({ ...porridge, ingredients }).ingredients[0].groupName).toBeNull()
  })

  it('rejects an empty step', () => {
    expect(firstError({ ...porridge, steps: [{ text: '  ', imageId: null }] })).toBe(
      'Steps cannot be empty'
    )
  })

  it('accepts focus points from 0 to 100', () => {
    const steps = [{ text: 'Simmer', imageId: 'step', imageFocusX: 0, imageFocusY: 100 }]
    const parsed = recipeSchema.parse({ ...porridge, coverFocusX: 25, coverFocusY: 75, steps })
    expect(parsed).toMatchObject({ coverFocusX: 25, coverFocusY: 75, steps })
  })

  it('leaves focus points out when omitted', () => {
    const parsed = recipeSchema.parse(porridge)
    expect(parsed).not.toHaveProperty('coverFocusX')
    expect(parsed.steps[0]).not.toHaveProperty('imageFocusX')
  })

  it('rejects a cover focus outside 0 to 100', () => {
    expect(firstError({ ...porridge, coverFocusX: -1 })).toBe('Focus must be between 0 and 100')
    expect(firstError({ ...porridge, coverFocusY: 101 })).toBe('Focus must be between 0 and 100')
  })

  it('rejects a step focus outside 0 to 100', () => {
    const steps = [{ text: 'Simmer', imageId: 'step', imageFocusY: 150 }]
    expect(firstError({ ...porridge, steps })).toBe('Focus must be between 0 and 100')
  })

  it('rejects a fractional focus', () => {
    expect(firstError({ ...porridge, coverFocusX: 12.5 })).toBe('Focus must be a whole number')
  })
})
