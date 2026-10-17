import { describe, expect, it } from 'vitest'
import { type IngredientInput, ingredientSchema } from './ingredient'

const oats: IngredientInput = {
  name: 'Oats',
  brand: null,
  kcal: 380,
  protein: 13,
  carbs: 60,
  fat: 7,
  fiber: null,
  density: 1,
  source: 'manual',
  sourceId: null,
  units: [],
}

function firstError(input: IngredientInput) {
  const result = ingredientSchema.safeParse(input)
  return result.success ? undefined : result.error.issues[0].message
}

describe('ingredientSchema', () => {
  it('accepts a minimal manual ingredient', () => {
    expect(ingredientSchema.safeParse(oats).success).toBe(true)
  })

  it('trims the name', () => {
    expect(ingredientSchema.parse({ ...oats, name: '  Oats ' }).name).toBe('Oats')
  })

  it('requires a non-blank name', () => {
    expect(firstError({ ...oats, name: '   ' })).toBe('Name is required')
  })

  it('turns a blank brand into null', () => {
    expect(ingredientSchema.parse({ ...oats, brand: '  ' }).brand).toBeNull()
  })

  it('rejects negative macros', () => {
    expect(firstError({ ...oats, protein: -1 })).toBe('Protein must be ≥ 0')
  })

  it('rejects a NaN macro', () => {
    expect(firstError({ ...oats, kcal: NaN })).toBe('Calories must be a number')
  })

  it('accepts zero for every macro', () => {
    const zero = { ...oats, kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    expect(ingredientSchema.safeParse(zero).success).toBe(true)
  })

  it('rejects a zero density', () => {
    expect(firstError({ ...oats, density: 0 })).toBe('Density must be > 0')
  })

  it('rejects an unknown source', () => {
    const result = ingredientSchema.safeParse({ ...oats, source: 'web' })
    expect(result.success).toBe(false)
  })

  it('trims custom unit names', () => {
    const { units } = ingredientSchema.parse({ ...oats, units: [{ name: ' cup ', grams: 90 }] })
    expect(units).toEqual([{ name: 'cup', grams: 90 }])
  })

  it('rejects a custom unit without grams', () => {
    expect(firstError({ ...oats, units: [{ name: 'cup', grams: 0 }] })).toBe(
      'Unit grams must be > 0'
    )
  })

  it('rejects a custom unit that shadows a base unit', () => {
    expect(firstError({ ...oats, units: [{ name: 'ml', grams: 2 }] })).toBe(
      'Custom units cannot be named g, kg, ml, l'
    )
  })

  it('rejects a custom unit that shadows a base unit in another case', () => {
    expect(firstError({ ...oats, units: [{ name: 'KG', grams: 2 }] })).toBe(
      'Custom units cannot be named g, kg, ml, l'
    )
  })

  it('accepts a custom unit that overrides a built-in household measure', () => {
    expect(
      ingredientSchema.safeParse({ ...oats, units: [{ name: 'tbsp', grams: 8 }] }).success
    ).toBe(true)
  })

  it('rejects duplicate custom unit names', () => {
    const units = [
      { name: 'cup', grams: 90 },
      { name: 'cup', grams: 80 },
    ]
    expect(firstError({ ...oats, units })).toBe('Custom unit names must be unique')
  })

  it('rejects custom unit names that differ only in case', () => {
    const units = [
      { name: 'Cup', grams: 90 },
      { name: 'cup', grams: 80 },
    ]
    expect(firstError({ ...oats, units })).toBe('Custom unit names must be unique')
  })
})
