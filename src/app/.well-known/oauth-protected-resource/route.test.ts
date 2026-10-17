import { describe, expect, it, vi } from 'vitest'
import { setupTestDb } from '@/test/db'

vi.mock('next/server', () => ({ connection: vi.fn(async () => {}) }))

await setupTestDb()
const { GET } = await import('./route')

const res = await GET(new Request('http://localhost:3000/.well-known/oauth-protected-resource'))
const body = await res.json()

describe('GET /.well-known/oauth-protected-resource', () => {
  it('responds 200 with JSON', () => {
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
  })

  it('names the MCP endpoint as the resource', () => {
    expect(body.resource).toBe('http://localhost:3000/api/mcp')
  })

  it('points at the app as the authorization server', () => {
    expect(body.authorization_servers).toEqual(['http://localhost:3000'])
  })

  it('accepts bearer tokens in the header', () => {
    expect(body.bearer_methods_supported).toEqual(['header'])
  })
})
