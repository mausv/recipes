import { describe, expect, it } from 'vitest'
import { likePattern, move } from './utils'

describe('move', () => {
  it('moves an item one place up', () => {
    expect(move(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'c', 'b'])
  })

  it('moves an item one place down', () => {
    expect(move(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c'])
  })

  it('moves an item across several places', () => {
    expect(move(['a', 'b', 'c', 'd'], 0, 3)).toEqual(['b', 'c', 'd', 'a'])
  })

  it('does not mutate the original list', () => {
    const list = ['a', 'b']
    move(list, 0, 1)
    expect(list).toEqual(['a', 'b'])
  })
})

describe('likePattern', () => {
  it('wraps the query in wildcards', () => {
    expect(likePattern('oat')).toBe('%oat%')
  })

  it('escapes percent signs', () => {
    expect(likePattern('100%')).toBe('%100\\%%')
  })

  it('escapes underscores', () => {
    expect(likePattern('a_b')).toBe('%a\\_b%')
  })

  it('escapes the escape character', () => {
    expect(likePattern('a\\b')).toBe('%a\\\\b%')
  })
})
