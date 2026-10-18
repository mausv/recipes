import { describe, expect, it, vi } from 'vitest'
import { translateError } from './errors'

vi.mock('./es/errors', () => ({
  errors: { 'Name is required': 'El nombre es obligatorio' },
  errorPatterns: [
    [
      /^Used by (.+)\. Remove it from those recipes first\.$/,
      (recipes: string) => `Usado por ${recipes}. Quítalo de esas recetas primero.`,
    ],
  ],
}))

describe('translateError', () => {
  it('translates an exact match', () => {
    expect(translateError('Name is required', 'es')).toBe('El nombre es obligatorio')
  })

  it('translates a pattern match with its captured groups', () => {
    expect(
      translateError('Used by Pancakes, Waffles. Remove it from those recipes first.', 'es')
    ).toBe('Usado por Pancakes, Waffles. Quítalo de esas recetas primero.')
  })

  it('falls back to the original message', () => {
    expect(translateError('Something odd', 'es')).toBe('Something odd')
  })

  it('ignores inherited object keys', () => {
    expect(translateError('constructor', 'es')).toBe('constructor')
  })

  it('passes English through untouched', () => {
    expect(translateError('Name is required', 'en')).toBe('Name is required')
  })
})
