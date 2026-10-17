import { describe, expect, it } from 'vitest'
import { applyPantry, mergeNeeds, scaleIngredientLines, type ShoppingLine } from './shopping'

function line(overrides: Partial<ShoppingLine> = {}): ShoppingLine {
  return {
    ingredientId: 'oats',
    name: 'Oats',
    grams: 100,
    quantity: 100,
    unit: 'g',
    recipeId: 'porridge',
    ...overrides,
  }
}

function needFor(lines: ShoppingLine[]) {
  return mergeNeeds(lines).needs
}

describe('mergeNeeds', () => {
  it('returns no needs and no free text for an empty list', () => {
    expect(mergeNeeds([])).toEqual({ needs: [], freeText: [] })
  })

  it('turns a single ingredient line into one need', () => {
    expect(needFor([line()])).toEqual([
      {
        ingredientId: 'oats',
        name: 'Oats',
        grams: 100,
        quantity: 100,
        unit: 'g',
        recipeIds: ['porridge'],
        lines: [line()],
      },
    ])
  })

  it('sums grams of the same ingredient across recipes', () => {
    const needs = needFor([line(), line({ grams: 50, quantity: 50, recipeId: 'cookies' })])
    expect(needs).toHaveLength(1)
    expect(needs[0].grams).toBe(150)
  })

  it('lists every source recipe once', () => {
    const needs = needFor([line(), line({ recipeId: 'cookies' }), line()])
    expect(needs[0].recipeIds).toEqual(['porridge', 'cookies'])
  })

  it('ignores lines without a recipe when listing source recipes', () => {
    const needs = needFor([line({ recipeId: null }), line()])
    expect(needs[0].recipeIds).toEqual(['porridge'])
  })

  it('keeps different ingredients as separate needs in first-seen order', () => {
    const needs = needFor([line(), line({ ingredientId: 'egg', name: 'Egg' })])
    expect(needs.map((n) => n.ingredientId)).toEqual(['oats', 'egg'])
  })

  it('keeps the source lines of each need', () => {
    const lines = [line(), line({ recipeId: 'cookies' })]
    expect(needFor(lines)[0].lines).toEqual(lines)
  })

  it('sums display quantities when every line shares a unit', () => {
    const needs = needFor([
      line({ ingredientId: 'egg', unit: 'piece', quantity: 2, grams: 100 }),
      line({ ingredientId: 'egg', unit: 'piece', quantity: 1, grams: 50 }),
    ])
    expect(needs[0]).toMatchObject({ quantity: 3, unit: 'piece' })
  })

  it('drops the display quantity when lines use different units', () => {
    const needs = needFor([line(), line({ unit: 'kg', quantity: 0.1 })])
    expect(needs[0]).toMatchObject({ quantity: null, unit: null, grams: 200 })
  })

  it('drops the display quantity when a line has no unit', () => {
    const needs = needFor([line({ unit: null, quantity: 2, grams: null })])
    expect(needs[0]).toMatchObject({ quantity: null, unit: null })
  })

  it('drops the display quantity when a line has no quantity', () => {
    const needs = needFor([line(), line({ quantity: null, grams: null })])
    expect(needs[0].quantity).toBeNull()
  })

  it('reports unknown grams when any line has no grams', () => {
    const needs = needFor([line(), line({ grams: null })])
    expect(needs[0].grams).toBeNull()
  })

  it('keeps free-text lines as they are', () => {
    const milk = line({ ingredientId: null, name: 'Milk', grams: null, quantity: 1, unit: 'l' })
    expect(mergeNeeds([milk, line()]).freeText).toEqual([milk])
  })

  it('does not merge free-text lines with the same name', () => {
    const milk = line({ ingredientId: null, name: 'Milk', grams: null })
    expect(mergeNeeds([milk, milk]).freeText).toHaveLength(2)
  })

  it('names the need after its first line', () => {
    const needs = needFor([line({ name: 'Rolled oats' }), line()])
    expect(needs[0].name).toBe('Rolled oats')
  })
})

describe('applyPantry', () => {
  it('needs the full amount when the ingredient is not in the pantry', () => {
    expect(applyPantry(needFor([line()]), [])[0]).toMatchObject({
      neededGrams: 100,
      haveGrams: 0,
      toBuyGrams: 100,
      covered: false,
    })
  })

  it('subtracts a partial pantry amount', () => {
    const [need] = applyPantry(needFor([line()]), [{ ingredientId: 'oats', grams: 30 }])
    expect(need).toMatchObject({ haveGrams: 30, toBuyGrams: 70, covered: false })
  })

  it('covers the need when the pantry has exactly enough', () => {
    const [need] = applyPantry(needFor([line()]), [{ ingredientId: 'oats', grams: 100 }])
    expect(need).toMatchObject({ toBuyGrams: 0, covered: true })
  })

  it('never asks to buy a negative amount when the pantry has more than needed', () => {
    const [need] = applyPantry(needFor([line()]), [{ ingredientId: 'oats', grams: 500 }])
    expect(need).toMatchObject({ haveGrams: 500, toBuyGrams: 0, covered: true })
  })

  it('treats an unknown pantry amount as fully covered', () => {
    const [need] = applyPantry(needFor([line()]), [{ ingredientId: 'oats', grams: null }])
    expect(need).toMatchObject({ haveGrams: null, toBuyGrams: 0, covered: true })
  })

  it('does not cover the need with zero grams in the pantry', () => {
    const [need] = applyPantry(needFor([line()]), [{ ingredientId: 'oats', grams: 0 }])
    expect(need).toMatchObject({ toBuyGrams: 100, covered: false })
  })

  it('applies the pantry to the merged total across recipes', () => {
    const needs = needFor([line(), line({ recipeId: 'cookies' })])
    const [need] = applyPantry(needs, [{ ingredientId: 'oats', grams: 150 }])
    expect(need).toMatchObject({ neededGrams: 200, toBuyGrams: 50, covered: false })
  })

  it('only applies pantry entries to their own ingredient', () => {
    const needs = needFor([line(), line({ ingredientId: 'egg', name: 'Egg' })])
    const result = applyPantry(needs, [{ ingredientId: 'egg', grams: null }])
    expect(result.map((n) => n.covered)).toEqual([false, true])
  })

  it('leaves the amount to buy unknown when the need has no grams', () => {
    const [need] = applyPantry(needFor([line({ grams: null })]), [
      { ingredientId: 'oats', grams: 50 },
    ])
    expect(need).toMatchObject({ toBuyGrams: null, covered: false })
  })

  it('covers a need without grams when the pantry has an unknown amount', () => {
    const [need] = applyPantry(needFor([line({ grams: null })]), [
      { ingredientId: 'oats', grams: null },
    ])
    expect(need.covered).toBe(true)
  })

  it('does not mark a zero need as covered without a pantry entry', () => {
    const [need] = applyPantry(needFor([line({ grams: 0, quantity: 0 })]), [])
    expect(need).toMatchObject({ toBuyGrams: 0, covered: false })
  })

  it('scales the display quantity to the amount left to buy', () => {
    const needs = needFor([line({ ingredientId: 'egg', unit: 'piece', quantity: 3, grams: 150 })])
    const [need] = applyPantry(needs, [{ ingredientId: 'egg', grams: 50 }])
    expect(need.toBuyQuantity).toBe(2)
  })

  it('keeps the full display quantity when nothing is in the pantry', () => {
    const [need] = applyPantry(needFor([line()]), [])
    expect(need.toBuyQuantity).toBe(100)
  })

  it('sets the display quantity to zero when covered', () => {
    const [need] = applyPantry(needFor([line({ grams: null })]), [
      { ingredientId: 'oats', grams: null },
    ])
    expect(need.toBuyQuantity).toBe(0)
  })

  it('keeps the display quantity when the amount to buy is unknown', () => {
    const [need] = applyPantry(needFor([line({ grams: null, quantity: 2, unit: 'bunch' })]), [
      { ingredientId: 'oats', grams: 50 },
    ])
    expect(need.toBuyQuantity).toBe(2)
  })

  it('has no display quantity when the need has none', () => {
    const needs = needFor([line(), line({ unit: 'kg' })])
    expect(applyPantry(needs, [])[0].toBuyQuantity).toBeNull()
  })

  it('keeps the need fields alongside the pantry results', () => {
    const [need] = applyPantry(needFor([line()]), [])
    expect(need).toMatchObject({ ingredientId: 'oats', name: 'Oats', recipeIds: ['porridge'] })
  })
})

describe('scaleIngredientLines', () => {
  const lines = [
    { id: 'a', quantity: 2, unit: 'piece', grams: 100 },
    { id: 'b', quantity: 80, unit: 'g', grams: 80 },
  ]

  it('returns the same amounts when servings do not change', () => {
    expect(scaleIngredientLines(lines, 2, 2)).toEqual(lines)
  })

  it('doubles quantity and grams when servings double', () => {
    expect(scaleIngredientLines(lines, 2, 4).map((l) => [l.quantity, l.grams])).toEqual([
      [4, 200],
      [160, 160],
    ])
  })

  it('scales down to fewer servings', () => {
    expect(scaleIngredientLines(lines, 4, 1)[0]).toMatchObject({ quantity: 0.5, grams: 25 })
  })

  it('handles uneven ratios', () => {
    expect(scaleIngredientLines(lines, 3, 2)[1].grams).toBeCloseTo(53.33)
  })

  it('keeps the other fields of each line', () => {
    expect(scaleIngredientLines(lines, 1, 3)[0]).toMatchObject({ id: 'a', unit: 'piece' })
  })

  it('scales to zero for zero target servings', () => {
    expect(scaleIngredientLines(lines, 2, 0)[0]).toMatchObject({ quantity: 0, grams: 0 })
  })

  it('returns an empty list for no lines', () => {
    expect(scaleIngredientLines([], 2, 4)).toEqual([])
  })

  it('does not modify the input lines', () => {
    scaleIngredientLines(lines, 1, 10)
    expect(lines[0]).toEqual({ id: 'a', quantity: 2, unit: 'piece', grams: 100 })
  })
})
