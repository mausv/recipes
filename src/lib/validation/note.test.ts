import { describe, expect, it } from 'vitest'
import { noteSchema } from './note'

describe('noteSchema', () => {
  it('trims the text', () => {
    expect(noteSchema.parse({ recipeId: 'r1', text: ' Less salt \n' }).text).toBe('Less salt')
  })

  it('accepts an empty note', () => {
    expect(noteSchema.parse({ recipeId: 'r1', text: '  ' }).text).toBe('')
  })

  it('requires a recipe id', () => {
    expect(noteSchema.safeParse({ recipeId: '', text: 'Less salt' }).success).toBe(false)
  })
})
