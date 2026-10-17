import { describe, expect, it } from 'vitest'
import { setupTestDb } from '@/test/db'

await setupTestDb()
const { GET } = await import('./route')

const res = await GET(new Request('http://localhost:3000/.well-known/oauth-authorization-server'))
const body = await res.json()

describe('GET /.well-known/oauth-authorization-server', () => {
  it('responds 200 with JSON', () => {
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
  })

  it('uses the app URL as issuer', () => {
    expect(body.issuer).toBe('http://localhost:3000')
  })

  it('lists the authorize, token and registration endpoints', () => {
    expect(body).toMatchObject({
      authorization_endpoint: 'http://localhost:3000/api/auth/oauth2/authorize',
      token_endpoint: 'http://localhost:3000/api/auth/oauth2/token',
      registration_endpoint: 'http://localhost:3000/api/auth/oauth2/register',
    })
  })

  it('supports S256 PKCE', () => {
    expect(body.code_challenge_methods_supported).toContain('S256')
  })

  it('supports the authorization code and refresh token grants', () => {
    expect(body.grant_types_supported).toEqual(
      expect.arrayContaining(['authorization_code', 'refresh_token'])
    )
  })

  it('allows public clients', () => {
    expect(body.token_endpoint_auth_methods_supported).toContain('none')
  })
})
