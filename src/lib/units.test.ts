import { describe, expect, it } from 'vitest'
import { BASE_UNITS, formatQuantity, toGrams } from './units'

const water = { density: 1, units: [] }
const oil = { density: 0.92, units: [] }
const egg = {
  density: 1,
  units: [
    { name: 'piece', grams: 50 },
    { name: 'yolk', grams: 18 },
  ],
}

describe('BASE_UNITS', () => {
  it('lists grams, kilograms, millilitres and litres', () => {
    expect(BASE_UNITS).toEqual(['g', 'kg', 'ml', 'l'])
  })
})

describe('toGrams', () => {
  it('returns grams unchanged', () => {
    expect(toGrams(250, 'g', water)).toBe(250)
  })

  it('converts kilograms to grams', () => {
    expect(toGrams(1.5, 'kg', water)).toBe(1500)
  })

  it('treats millilitres of a density-1 ingredient as grams', () => {
    expect(toGrams(200, 'ml', water)).toBe(200)
  })

  it('applies density to millilitres', () => {
    expect(toGrams(100, 'ml', oil)).toBeCloseTo(92)
  })

  it('applies density to litres', () => {
    expect(toGrams(2, 'l', oil)).toBeCloseTo(1840)
  })

  it('ignores density for mass units', () => {
    expect(toGrams(100, 'g', oil)).toBe(100)
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

  it('returns zero for a zero quantity', () => {
    expect(toGrams(0, 'kg', water)).toBe(0)
  })

  it('throws on a unit the ingredient does not define', () => {
    expect(() => toGrams(1, 'cup', egg)).toThrow('Unknown unit: cup')
  })

  it('matches unit names case-sensitively', () => {
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
