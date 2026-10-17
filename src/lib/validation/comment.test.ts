import { describe, expect, it } from 'vitest'
import { commentSchema } from './comment'

describe('commentSchema', () => {
  it('trims the text', () => {
    expect(commentSchema.parse({ recipeId: 'r1', text: '  Lovely  ' }).text).toBe('Lovely')
  })

  it('rejects a blank comment', () => {
    const result = commentSchema.safeParse({ recipeId: 'r1', text: '   ' })
    expect(result.error?.issues[0].message).toBe('Comment cannot be empty')
  })

  it('requires a recipe id', () => {
    expect(commentSchema.safeParse({ recipeId: '', text: 'Lovely' }).success).toBe(false)
  })
})
