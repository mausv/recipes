import { describe, expect, it } from 'vitest'
import {
  computeRecipeBreakdown,
  computeRecipeNutrition,
  formatGrams,
  formatKcal,
  type Macros,
  multiplyMacros,
  scaleMacros,
  sumMacros,
  toMacros,
} from './nutrition'

const zero: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
const oats: Macros = { kcal: 380, protein: 13, carbs: 60, fat: 7, fiber: 10 }
const milk: Macros = { kcal: 60, protein: 3.4, carbs: 4.8, fat: 3, fiber: 0 }

describe('scaleMacros', () => {
  it('returns the per-100 g values for 100 g', () => {
    expect(scaleMacros(oats, 100)).toEqual(oats)
  })

  it('scales every macro proportionally to the weight', () => {
    expect(scaleMacros(oats, 50)).toEqual({
      kcal: 190,
      protein: 6.5,
      carbs: 30,
      fat: 3.5,
      fiber: 5,
    })
  })

  it('returns zeros for zero grams', () => {
    expect(scaleMacros(oats, 0)).toEqual(zero)
  })
})

describe('sumMacros', () => {
  it('returns zeros for an empty list', () => {
    expect(sumMacros([])).toEqual(zero)
  })

  it('adds each macro across the list', () => {
    expect(sumMacros([oats, milk])).toEqual({
      kcal: 440,
      protein: 16.4,
      carbs: 64.8,
      fat: 10,
      fiber: 10,
    })
  })
})

describe('computeRecipeNutrition', () => {
  const porridge = [
    { grams: 50, per100g: oats },
    { grams: 200, per100g: milk },
  ]

  it('totals the macros of every ingredient by weight', () => {
    const { total } = computeRecipeNutrition({ ingredients: porridge, servings: 1 })
    expect(total.kcal).toBeCloseTo(310)
    expect(total.protein).toBeCloseTo(13.3)
  })

  it('sums the raw ingredient weights', () => {
    expect(computeRecipeNutrition({ ingredients: porridge, servings: 1 }).totalGrams).toBe(250)
  })

  it('returns the total as the per-serving value for a single serving', () => {
    const result = computeRecipeNutrition({ ingredients: porridge, servings: 1 })
    expect(result.perServing).toEqual(result.total)
  })

  it('divides the total across servings', () => {
    const { perServing } = computeRecipeNutrition({ ingredients: porridge, servings: 2 })
    expect(perServing.kcal).toBeCloseTo(155)
    expect(perServing.fat).toBeCloseTo(4.75)
  })

  it('bases per-100 g on the summed ingredient weight when no cooked weight is set', () => {
    const { per100g } = computeRecipeNutrition({ ingredients: porridge, servings: 1 })
    expect(per100g.kcal).toBeCloseTo(124)
  })

  it('treats a null cooked weight like an unset one', () => {
    const { per100g } = computeRecipeNutrition({
      ingredients: porridge,
      servings: 1,
      cookedWeightGrams: null,
    })
    expect(per100g.kcal).toBeCloseTo(124)
  })

  it('bases per-100 g on the cooked weight when set', () => {
    const { per100g } = computeRecipeNutrition({
      ingredients: porridge,
      servings: 1,
      cookedWeightGrams: 310,
    })
    expect(per100g.kcal).toBeCloseTo(100)
  })

  it('does not let cooked weight change the total or per-serving values', () => {
    const raw = computeRecipeNutrition({ ingredients: porridge, servings: 2 })
    const cooked = computeRecipeNutrition({
      ingredients: porridge,
      servings: 2,
      cookedWeightGrams: 400,
    })
    expect(cooked.total).toEqual(raw.total)
    expect(cooked.perServing).toEqual(raw.perServing)
  })

  it('does not let servings change the per-100 g values', () => {
    const one = computeRecipeNutrition({ ingredients: porridge, servings: 1 })
    const four = computeRecipeNutrition({ ingredients: porridge, servings: 4 })
    expect(four.per100g).toEqual(one.per100g)
  })

  it('does not round results', () => {
    const { perServing } = computeRecipeNutrition({
      ingredients: [{ grams: 100, per100g: oats }],
      servings: 3,
    })
    expect(perServing.kcal).toBeCloseTo(126.6667, 4)
  })

  it('returns zeros everywhere for a recipe without ingredients', () => {
    expect(computeRecipeNutrition({ ingredients: [], servings: 2 })).toEqual({
      total: zero,
      perServing: zero,
      per100g: zero,
      totalGrams: 0,
    })
  })

  it('returns zero per-100 g when every ingredient weighs nothing', () => {
    const { per100g } = computeRecipeNutrition({
      ingredients: [{ grams: 0, per100g: oats }],
      servings: 1,
    })
    expect(per100g).toEqual(zero)
  })
})

describe('multiplyMacros', () => {
  it('multiplies every macro by the factor', () => {
    expect(multiplyMacros(oats, 2)).toEqual({
      kcal: 760,
      protein: 26,
      carbs: 120,
      fat: 14,
      fiber: 20,
    })
  })
})

describe('toMacros', () => {
  it('keeps the four core macros as they are', () => {
    expect(toMacros({ ...oats, fiber: 10 })).toEqual(oats)
  })

  it('treats unknown fiber as zero', () => {
    expect(toMacros({ ...oats, fiber: null }).fiber).toBe(0)
  })
})

describe('computeRecipeBreakdown', () => {
  const lines = [
    { grams: 50, ingredient: oats },
    { grams: 200, ingredient: { ...milk, fiber: null } },
  ]

  it('matches computeRecipeNutrition for the same weights', () => {
    const { contributions, ...nutrition } = computeRecipeBreakdown({ lines, servings: 2 })
    expect(contributions).toHaveLength(2)
    expect(nutrition).toEqual(
      computeRecipeNutrition({
        ingredients: [
          { grams: 50, per100g: oats },
          { grams: 200, per100g: milk },
        ],
        servings: 2,
      })
    )
  })

  it('returns each line’s contribution scaled by its weight', () => {
    const { contributions } = computeRecipeBreakdown({ lines, servings: 1 })
    expect(contributions[0]).toEqual(scaleMacros(oats, 50))
    expect(contributions[1].kcal).toBeCloseTo(120)
  })

  it('passes the cooked weight through to per-100 g', () => {
    const { per100g } = computeRecipeBreakdown({ lines, servings: 1, cookedWeightGrams: 310 })
    expect(per100g.kcal).toBeCloseTo(100)
  })

  it('returns no contributions for a recipe without lines', () => {
    expect(computeRecipeBreakdown({ lines: [], servings: 1 }).contributions).toEqual([])
  })
})

describe('formatKcal', () => {
  it('rounds to a whole number', () => {
    expect(formatKcal(126.6667)).toBe('127')
  })

  it('formats zero', () => {
    expect(formatKcal(0)).toBe('0')
  })
})

describe('formatGrams', () => {
  it('rounds to one decimal', () => {
    expect(formatGrams(13.26)).toBe('13.3')
  })

  it('drops a trailing zero decimal', () => {
    expect(formatGrams(7.04)).toBe('7')
  })
})
