import { describe, expect, it } from 'vitest'
import { groupSchema } from './group'

describe('groupSchema', () => {
  it('trims the name', () => {
    expect(groupSchema.parse({ name: '  Home  ' }).name).toBe('Home')
  })

  it('rejects a blank name', () => {
    expect(groupSchema.safeParse({ name: '  ' }).error?.issues[0].message).toBe('Name is required')
  })

  it('rejects a name longer than 60 characters', () => {
    expect(groupSchema.safeParse({ name: 'x'.repeat(61) }).error?.issues[0].message).toBe(
      'Name must be 60 characters or less'
    )
  })
})
