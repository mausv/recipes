import { describe, expect, it } from 'vitest'
import { setupTestDb } from '@/test/db'

const { insertUser } = await setupTestDb()
const { createApiKey } = await import('@/lib/api-keys')
const route = await import('./route')

const { key } = createApiKey(insertUser().id, 'Test')

function post(body: unknown, authorization?: string) {
  const headers = new Headers({
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  })
  if (authorization) headers.set('Authorization', authorization)
  return route.POST(
    new Request('http://localhost/api/mcp', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
  )
}

const initialize = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'test', version: '1.0.0' },
  },
}

describe('POST /api/mcp', () => {
  it('returns 401 with a resource metadata challenge without a key', async () => {
    const res = await post(initialize)
    expect(res.status).toBe(401)
    expect(res.headers.get('www-authenticate')).toBe(
      'Bearer resource_metadata="http://localhost:3000/.well-known/oauth-protected-resource"'
    )
  })

  it('returns 401 for an unknown key', async () => {
    expect((await post(initialize, 'Bearer rcp_nope')).status).toBe(401)
  })

  it('returns 401 for a non-bearer scheme', async () => {
    expect((await post(initialize, `Basic ${key}`)).status).toBe(401)
  })

  it('initializes with a valid key', async () => {
    const res = await post(initialize, `Bearer ${key}`)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      result: { serverInfo: { name: 'recipes' }, capabilities: { tools: {} } },
    })
  })

  it('lists tools with a valid key', async () => {
    const res = await post({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, `Bearer ${key}`)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      id: 2,
      result: { tools: expect.arrayContaining([expect.objectContaining({ name: 'get_recipe' })]) },
    })
  })
})

describe('other methods', () => {
  it('only handles POST, so Next answers GET and DELETE with 405', () => {
    expect(Object.keys(route)).toEqual(['POST'])
  })
})
