import { describe, expect, it } from 'vitest'
import { BUILT_IN_UNITS, builtInUnitsFor, formatQuantity, isKnownUnit, toGrams } from './units'

const water = { density: 1, units: [] }
const oil = { density: 0.92, units: [] }
const egg = {
  density: 1,
  units: [
    { name: 'piece', grams: 50 },
    { name: 'yolk', grams: 18 },
  ],
}
const oats = { density: 0.4, units: [{ name: 'Cup', grams: 90 }] }

describe('BUILT_IN_UNITS', () => {
  it('lists weight units before volume units in picker order', () => {
    expect(BUILT_IN_UNITS.map((u) => [u.label, u.kind])).toEqual([
      ['g', 'weight'],
      ['kg', 'weight'],
      ['oz', 'weight'],
      ['lb', 'weight'],
      ['ml', 'volume'],
      ['l', 'volume'],
      ['tsp', 'volume'],
      ['tbsp', 'volume'],
      ['cup', 'volume'],
      ['fl oz', 'volume'],
    ])
  })
})

describe('builtInUnitsFor', () => {
  it('returns every built-in unit for an ingredient without custom units', () => {
    expect(builtInUnitsFor([])).toEqual(BUILT_IN_UNITS)
  })

  it('leaves out built-in units shadowed by a custom unit, case-insensitively', () => {
    expect(builtInUnitsFor(oats.units).map((u) => u.name)).not.toContain('cup')
  })
})

describe('isKnownUnit', () => {
  it('accepts a built-in unit', () => {
    expect(isKnownUnit('tbsp', [])).toBe(true)
  })

  it('accepts a custom unit regardless of case', () => {
    expect(isKnownUnit('PIECE', egg.units)).toBe(true)
  })

  it('rejects a unit that is neither built in nor custom', () => {
    expect(isKnownUnit('dozen', egg.units)).toBe(false)
  })
})

describe('toGrams', () => {
  it.each([
    ['g', 250, 250],
    ['kg', 1.5, 1500],
    ['oz', 2, 56.699],
    ['lb', 1, 453.592],
  ])('converts %s to grams', (unit, quantity, grams) => {
    expect(toGrams(quantity, unit, water)).toBeCloseTo(grams)
  })

  it.each([
    ['ml', 200, 200],
    ['l', 2, 2000],
    ['tsp', 1, 5],
    ['tbsp', 2, 30],
    ['cup', 1, 240],
    ['fl oz', 1, 29.5735],
  ])('converts %s of a density-1 ingredient to grams', (unit, quantity, grams) => {
    expect(toGrams(quantity, unit, water)).toBeCloseTo(grams)
  })

  it.each([
    ['ml', 100, 92],
    ['l', 2, 1840],
    ['tsp', 1, 4.6],
    ['tbsp', 1, 13.8],
    ['cup', 1, 220.8],
    ['fl oz', 1, 27.20762],
  ])('applies density to %s', (unit, quantity, grams) => {
    expect(toGrams(quantity, unit, oil)).toBeCloseTo(grams)
  })

  it.each([
    ['g', 100, 100],
    ['kg', 1, 1000],
    ['oz', 1, 28.3495],
    ['lb', 1, 453.592],
  ])('ignores density for %s', (unit, quantity, grams) => {
    expect(toGrams(quantity, unit, oil)).toBeCloseTo(grams)
  })

  it('converts a custom unit using its gram weight', () => {
    expect(toGrams(3, 'piece', egg)).toBe(150)
  })

  it('picks the matching custom unit among several', () => {
    expect(toGrams(2, 'yolk', egg)).toBe(36)
  })

  it('supports fractional quantities of custom units', () => {
    expect(toGrams(0.5, 'piece', egg)).toBe(25)
  })

  it('prefers a custom unit over the built-in volume unit of the same name', () => {
    expect(toGrams(2, 'Cup', oats)).toBe(180)
  })

  it('matches custom unit names case-insensitively', () => {
    expect(toGrams(1, 'cup', oats)).toBe(90)
  })

  it('returns zero for a zero quantity', () => {
    expect(toGrams(0, 'kg', water)).toBe(0)
  })

  it('throws on a unit that is neither built in nor defined by the ingredient', () => {
    expect(() => toGrams(1, 'dozen', egg)).toThrow('Unknown unit: dozen')
  })

  it('matches built-in unit names case-sensitively', () => {
    expect(() => toGrams(1, 'G', water)).toThrow('Unknown unit: G')
  })
})

describe('formatQuantity', () => {
  it('prints whole numbers without decimals', () => {
    expect(formatQuantity(2)).toBe('2')
  })

  it('trims trailing zeros', () => {
    expect(formatQuantity(1.5)).toBe('1.5')
  })

  it('rounds to at most two decimals', () => {
    expect(formatQuantity(1 / 3)).toBe('0.33')
  })

  it('drops zeros left over after rounding', () => {
    expect(formatQuantity(2.0001)).toBe('2')
  })

  it('formats zero', () => {
    expect(formatQuantity(0)).toBe('0')
  })
})
