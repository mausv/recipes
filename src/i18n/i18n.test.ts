import { describe, expect, it } from 'vitest'
import { dictionaries, isLocale, matchLocale } from '.'
import { dateFormatter, intlLocale, unitLabel } from './format'
import { BUILT_IN_UNITS } from '@/lib/units'

function shape(value: unknown): unknown {
  if (typeof value === 'function') return 'function'
  if (typeof value === 'string') return 'string'
  if (typeof value === 'object' && value !== null)
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, shape(v)])
    )
  return typeof value
}

describe('dictionaries', () => {
  it('has the same areas in every locale', () => {
    expect(Object.keys(dictionaries.es).sort()).toEqual(Object.keys(dictionaries.en).sort())
  })

  const spanish = new Map(Object.entries(dictionaries.es))

  it.each(Object.entries(dictionaries.en))(
    'has the same keys in the Spanish %s file',
    (area, en) => {
      expect(shape(spanish.get(area))).toEqual(shape(en))
    }
  )
})

describe('isLocale', () => {
  it('accepts supported locales only', () => {
    expect(isLocale('en')).toBe(true)
    expect(isLocale('es')).toBe(true)
    expect(isLocale('fr')).toBe(false)
    expect(isLocale(undefined)).toBe(false)
  })
})

describe('matchLocale', () => {
  it.each([
    ['es-MX,es;q=0.9', 'es'],
    ['es', 'es'],
    ['ES-ar', 'es'],
    ['en-US', 'en'],
    ['en-US,en;q=0.9,es;q=0.8', 'en'],
    ['fr-FR,es;q=0.5', 'es'],
    ['en;q=0.2,es;q=0.8', 'es'],
    ['es;q=0,en;q=0.5', 'en'],
    ['fr-FR', 'en'],
    ['*', 'en'],
    ['garbage;;q=x,,', 'en'],
    ['', 'en'],
    [null, 'en'],
  ])('maps %j to %s', (header, locale) => {
    expect(matchLocale(header)).toBe(locale)
  })
})

describe('unitLabel', () => {
  it('translates Spanish spoon, cup and fluid ounce labels', () => {
    expect(BUILT_IN_UNITS.map((u) => unitLabel(u.name, 'es'))).toEqual([
      'g',
      'kg',
      'oz',
      'lb',
      'ml',
      'l',
      'cdta',
      'cda',
      'taza',
      'oz fl',
    ])
  })

  it('keeps built-in English labels', () => {
    expect(BUILT_IN_UNITS.map((u) => unitLabel(u.name, 'en'))).toEqual(
      BUILT_IN_UNITS.map((u) => u.label)
    )
  })

  it('shows custom units as-is', () => {
    expect(unitLabel('pinch', 'es')).toBe('pinch')
    expect(unitLabel('constructor', 'es')).toBe('constructor')
  })
})

describe('dateFormatter', () => {
  const date = new Date(Date.UTC(2026, 9, 18))

  it('formats with the locale’s regional conventions', () => {
    expect(intlLocale('en')).toBe('en-US')
    expect(intlLocale('es')).toBe('es-MX')
    expect(dateFormatter('en', { dateStyle: 'long', timeZone: 'UTC' }).format(date)).toBe(
      'October 18, 2026'
    )
    expect(dateFormatter('es', { dateStyle: 'long', timeZone: 'UTC' }).format(date)).toBe(
      '18 de octubre de 2026'
    )
  })
})
