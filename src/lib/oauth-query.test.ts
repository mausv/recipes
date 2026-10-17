import { describe, expect, it } from 'vitest'
import { signedOAuthQuery, toQueryString } from './oauth-query'

describe('signedOAuthQuery', () => {
  it('returns nothing for a plain login URL', () => {
    expect(signedOAuthQuery('')).toBeUndefined()
  })

  it('returns nothing when the query is not signed', () => {
    expect(
      signedOAuthQuery('?client_id=abc&redirect_uri=https%3A%2F%2Fevil.example')
    ).toBeUndefined()
  })

  it('returns the signed authorization request without the leading ?', () => {
    expect(signedOAuthQuery('?client_id=abc&exp=1&sig=xyz')).toBe('client_id=abc&exp=1&sig=xyz')
  })

  it('keeps repeated parameters', () => {
    expect(signedOAuthQuery('?ba_param=a&ba_param=b&sig=xyz')).toBe('ba_param=a&ba_param=b&sig=xyz')
  })
})

describe('toQueryString', () => {
  it('serializes single values', () => {
    expect(toQueryString({ client_id: 'abc', scope: 'offline_access' })).toBe(
      'client_id=abc&scope=offline_access'
    )
  })

  it('repeats array values', () => {
    expect(toQueryString({ ba_param: ['a', 'b'] })).toBe('ba_param=a&ba_param=b')
  })

  it('skips undefined values', () => {
    expect(toQueryString({ client_id: 'abc', state: undefined })).toBe('client_id=abc')
  })

  it('encodes URLs', () => {
    expect(toQueryString({ redirect_uri: 'https://claude.ai/cb' })).toBe(
      'redirect_uri=https%3A%2F%2Fclaude.ai%2Fcb'
    )
  })
})
