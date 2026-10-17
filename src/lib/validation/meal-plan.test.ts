import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import {
  addEntrySchema,
  dateSchema,
  monthSchema,
  moveEntrySchema,
  updateEntrySchema,
} from './meal-plan'

function firstError(schema: z.ZodType, value: unknown) {
  const result = schema.safeParse(value)
  return result.success ? undefined : result.error.issues[0].message
}

describe('dateSchema', () => {
  it('accepts a calendar date', () => {
    expect(dateSchema.parse('2026-10-14')).toBe('2026-10-14')
  })

  it('accepts a leap day', () => {
    expect(dateSchema.parse('2028-02-29')).toBe('2028-02-29')
  })

  it('rejects a leap day in a common year', () => {
    expect(firstError(dateSchema, '2026-02-29')).toBe('Pick a valid date')
  })

  it('rejects a day past the end of the month', () => {
    expect(firstError(dateSchema, '2026-04-31')).toBe('Pick a valid date')
  })

  it('rejects another format', () => {
    expect(firstError(dateSchema, '14/10/2026')).toBe('Pick a valid date')
  })

  it('rejects a date with a time', () => {
    expect(firstError(dateSchema, '2026-10-14T10:00')).toBe('Pick a valid date')
  })
})

describe('monthSchema', () => {
  it('accepts a year and month', () => {
    expect(monthSchema.parse('2026-10')).toBe('2026-10')
  })

  it('rejects month 13', () => {
    expect(firstError(monthSchema, '2026-13')).toBe('Pick a valid month')
  })
})

describe('addEntrySchema', () => {
  it('accepts a recipe entry and fills the note with null', () => {
    expect(
      addEntrySchema.parse({ date: '2026-10-14', slot: 'dinner', recipeId: 'r1', servings: 2 })
    ).toEqual({ date: '2026-10-14', slot: 'dinner', recipeId: 'r1', servings: 2, note: null })
  })

  it('accepts a note entry and trims it', () => {
    expect(
      addEntrySchema.parse({ date: '2026-10-14', slot: 'lunch', note: ' Leftovers ' })
    ).toMatchObject({ recipeId: null, servings: null, note: 'Leftovers' })
  })

  it('accepts fractional servings', () => {
    expect(
      addEntrySchema.parse({ date: '2026-10-14', slot: 'dinner', recipeId: 'r1', servings: 1.5 })
        .servings
    ).toBe(1.5)
  })

  it('rejects an entry with both a recipe and a note', () => {
    expect(
      firstError(addEntrySchema, {
        date: '2026-10-14',
        slot: 'dinner',
        recipeId: 'r1',
        note: 'Out',
      })
    ).toBe('Pick a recipe or write a note')
  })

  it('rejects an entry with neither a recipe nor a note', () => {
    expect(firstError(addEntrySchema, { date: '2026-10-14', slot: 'dinner' })).toBe(
      'Pick a recipe or write a note'
    )
  })

  it('rejects an unknown slot', () => {
    expect(firstError(addEntrySchema, { date: '2026-10-14', slot: 'brunch', note: 'x' })).toBe(
      'Pick a meal'
    )
  })

  it('rejects zero servings', () => {
    expect(
      firstError(addEntrySchema, {
        date: '2026-10-14',
        slot: 'dinner',
        recipeId: 'r1',
        servings: 0,
      })
    ).toBe('Servings must be > 0')
  })

  it('rejects a note longer than 200 characters', () => {
    expect(
      firstError(addEntrySchema, { date: '2026-10-14', slot: 'dinner', note: 'a'.repeat(201) })
    ).toBe('Keep the note to 200 characters')
  })

  it('rejects an invalid date', () => {
    expect(firstError(addEntrySchema, { date: '2026-02-30', slot: 'dinner', note: 'x' })).toBe(
      'Pick a valid date'
    )
  })
})

describe('updateEntrySchema', () => {
  it('accepts new servings', () => {
    expect(updateEntrySchema.parse({ servings: 3 })).toEqual({ servings: 3 })
  })

  it('accepts null servings to fall back to the recipe', () => {
    expect(updateEntrySchema.parse({ servings: null })).toEqual({ servings: null })
  })

  it('rejects a blank note', () => {
    expect(firstError(updateEntrySchema, { note: '  ' })).toBe('Write a note')
  })

  it('rejects an empty change', () => {
    expect(firstError(updateEntrySchema, {})).toBe('Nothing to change')
  })
})

describe('moveEntrySchema', () => {
  it('accepts a date and slot', () => {
    expect(moveEntrySchema.parse({ date: '2026-10-15', slot: 'snack' })).toEqual({
      date: '2026-10-15',
      slot: 'snack',
    })
  })

  it('requires a slot', () => {
    expect(firstError(moveEntrySchema, { date: '2026-10-15' })).toBe('Pick a meal')
  })
})
