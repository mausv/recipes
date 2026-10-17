import { createHash, randomBytes } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { setupTestDb } from '@/test/db'

await setupTestDb()
vi.stubEnv('INVITE_CODE', 'open-sesame')
const { auth } = await import('@/lib/auth')
const { createApiKey } = await import('@/lib/api-keys')
const { revokeConnectedClient } = await import('@/lib/oauth')
const route = await import('./route')

const BASE = 'http://localhost:3000'
const RESOURCE = `${BASE}/api/mcp`
const REDIRECT_URI = 'https://claude.ai/api/mcp/auth_callback'

function authRequest(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('origin', BASE)
  return auth.handler(new Request(`${BASE}/api/auth${path}`, { ...init, headers }))
}

function postJson(path: string, body: unknown, cookie?: string) {
  return authRequest(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie && { cookie }) },
    body: JSON.stringify(body),
  })
}

function postForm(path: string, body: Record<string, string>) {
  return authRequest(path, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  })
}

async function registerClient(name = 'Claude') {
  const res = await postJson('/oauth2/register', {
    client_name: name,
    redirect_uris: [REDIRECT_URI],
    token_endpoint_auth_method: 'none',
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
  })
  return { status: res.status, client: await res.json() }
}

async function signUp() {
  const email = `${crypto.randomUUID()}@example.com`
  const res = await postJson('/sign-up/email', {
    name: 'Ana',
    email,
    password: 'correct-horse-battery',
    inviteCode: 'open-sesame',
  })
  const { user } = await res.json()
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')
  return { userId: user.id, email, cookie }
}

function pkce() {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

function authorize(clientId: string, challenge: string, cookie?: string) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state: 'state-123',
    resource: RESOURCE,
  })
  return authRequest(`/oauth2/authorize?${params}`, { headers: cookie ? { cookie } : {} })
}

function location(res: Response) {
  return new URL(res.headers.get('location') ?? '', BASE)
}

async function consent(oauthQuery: string, accept: boolean, cookie: string) {
  const res = await postJson('/oauth2/consent', { accept, oauth_query: oauthQuery }, cookie)
  const { url } = await res.json()
  return new URL(url)
}

function exchangeCode(clientId: string, code: string, verifier: string) {
  return postForm('/oauth2/token', {
    grant_type: 'authorization_code',
    client_id: clientId,
    code,
    code_verifier: verifier,
    redirect_uri: REDIRECT_URI,
    resource: RESOURCE,
  })
}

function refresh(clientId: string, refreshToken: string) {
  return postForm('/oauth2/token', {
    grant_type: 'refresh_token',
    client_id: clientId,
    refresh_token: refreshToken,
    resource: RESOURCE,
  })
}

function listTools(authorization?: string) {
  const headers = new Headers({
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  })
  if (authorization) headers.set('Authorization', authorization)
  return route.POST(
    new Request(RESOURCE, {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    })
  )
}

async function connect() {
  const { client } = await registerClient()
  const user = await signUp()
  const { verifier, challenge } = pkce()
  const toConsent = location(await authorize(client.client_id, challenge, user.cookie))
  const callback = await consent(toConsent.search.slice(1), true, user.cookie)
  const tokenRes = await exchangeCode(
    client.client_id,
    callback.searchParams.get('code') ?? '',
    verifier
  )
  return { client, user, callback, tokens: await tokenRes.json(), tokenStatus: tokenRes.status }
}

const connected = await connect()

describe('dynamic client registration', () => {
  it('registers a public client without a session', async () => {
    const { status, client } = await registerClient()
    expect(status).toBe(201)
    expect(client.client_id).toEqual(expect.any(String))
    expect(client.redirect_uris).toEqual([REDIRECT_URI])
  })
})

describe('authorize', () => {
  it('sends a signed-out user to /login with the signed authorization request', async () => {
    const { client } = await registerClient()
    const res = await authorize(client.client_id, pkce().challenge)
    const to = location(res)
    expect(res.status).toBe(302)
    expect(to.pathname).toBe('/login')
    expect(to.searchParams.get('client_id')).toBe(client.client_id)
    expect(to.searchParams.get('sig')).toEqual(expect.any(String))
  })

  it('sends a signed-in user to the consent page', async () => {
    const { client } = await registerClient()
    const { cookie } = await signUp()
    const to = location(await authorize(client.client_id, pkce().challenge, cookie))
    expect(to.pathname).toBe('/oauth/consent')
    expect(to.searchParams.get('client_id')).toBe(client.client_id)
  })

  it('resumes the authorization after signing in from the login page', async () => {
    const { client } = await registerClient()
    const { email } = await signUp()
    const toLogin = location(await authorize(client.client_id, pkce().challenge))
    const res = await postJson('/sign-in/email', {
      email,
      password: 'correct-horse-battery',
      oauth_query: toLogin.search.slice(1),
    })
    const body = await res.json()
    expect(body.redirect).toBe(true)
    expect(new URL(body.url, BASE).pathname).toBe('/oauth/consent')
  })

  it('resumes the authorization after signing up from the login page', async () => {
    const { client } = await registerClient()
    const toLogin = location(await authorize(client.client_id, pkce().challenge))
    const res = await postJson('/sign-up/email', {
      name: 'Ben',
      email: `${crypto.randomUUID()}@example.com`,
      password: 'correct-horse-battery',
      inviteCode: 'open-sesame',
      oauth_query: toLogin.search.slice(1),
    })
    const body = await res.json()
    expect(body.redirect).toBe(true)
    expect(new URL(body.url, BASE).pathname).toBe('/oauth/consent')
  })

  it('ignores a forged authorization request on sign-in', async () => {
    const { client } = await registerClient()
    const { email } = await signUp()
    const toLogin = location(await authorize(client.client_id, pkce().challenge))
    toLogin.searchParams.set('redirect_uri', 'https://evil.example/cb')
    const res = await postJson('/sign-in/email', {
      email,
      password: 'correct-horse-battery',
      oauth_query: toLogin.search.slice(1),
    })
    expect(res.status).toBe(400)
  })

  it('skips consent once the user approved the client', async () => {
    const to = location(
      await authorize(connected.client.client_id, pkce().challenge, connected.user.cookie)
    )
    expect(to.origin + to.pathname).toBe(REDIRECT_URI)
    expect(to.searchParams.get('code')).toEqual(expect.any(String))
  })
})

describe('consent', () => {
  it('redirects to the client with a code and the original state on approve', () => {
    expect(connected.callback.origin + connected.callback.pathname).toBe(REDIRECT_URI)
    expect(connected.callback.searchParams.get('code')).toEqual(expect.any(String))
    expect(connected.callback.searchParams.get('state')).toBe('state-123')
  })

  it('redirects to the client with access_denied on deny', async () => {
    const { client } = await registerClient()
    const { cookie } = await signUp()
    const toConsent = location(await authorize(client.client_id, pkce().challenge, cookie))
    const callback = await consent(toConsent.search.slice(1), false, cookie)
    expect(callback.origin + callback.pathname).toBe(REDIRECT_URI)
    expect(callback.searchParams.get('error')).toBe('access_denied')
    expect(callback.searchParams.get('state')).toBe('state-123')
  })

  it('rejects a tampered authorization request', async () => {
    const { client } = await registerClient()
    const { cookie } = await signUp()
    const toConsent = location(await authorize(client.client_id, pkce().challenge, cookie))
    toConsent.searchParams.set('state', 'forged')
    const res = await postJson(
      '/oauth2/consent',
      { accept: true, oauth_query: toConsent.search.slice(1) },
      cookie
    )
    expect(res.status).toBe(400)
  })
})

describe('token endpoint', () => {
  it('exchanges the code for an access and a refresh token', () => {
    expect(connected.tokenStatus).toBe(200)
    expect(connected.tokens).toMatchObject({
      token_type: 'Bearer',
      access_token: expect.any(String),
      refresh_token: expect.any(String),
      expires_in: 3600,
    })
  })

  it('rejects the code with the wrong PKCE verifier', async () => {
    const { client } = await registerClient()
    const { cookie } = await signUp()
    const toConsent = location(await authorize(client.client_id, pkce().challenge, cookie))
    const callback = await consent(toConsent.search.slice(1), true, cookie)
    const res = await exchangeCode(
      client.client_id,
      callback.searchParams.get('code') ?? '',
      pkce().verifier
    )
    expect(res.status).toBe(401)
    expect(await res.json()).not.toHaveProperty('access_token')
  })

  it('issues a working access token from the refresh token', async () => {
    const { client, tokens } = await connect()
    const res = await refresh(client.client_id, tokens.refresh_token)
    const refreshed = await res.json()
    expect(res.status).toBe(200)
    expect(refreshed.access_token).not.toBe(tokens.access_token)
    expect((await listTools(`Bearer ${refreshed.access_token}`)).status).toBe(200)
  })
})

describe('POST /api/mcp with OAuth', () => {
  it('lists tools with the access token', async () => {
    const res = await listTools(`Bearer ${connected.tokens.access_token}`)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      result: { tools: expect.arrayContaining([expect.objectContaining({ name: 'get_recipe' })]) },
    })
  })

  it('challenges a request without a token with the resource metadata URL', async () => {
    const res = await listTools()
    expect(res.status).toBe(401)
    expect(res.headers.get('www-authenticate')).toBe(
      `Bearer resource_metadata="${BASE}/.well-known/oauth-protected-resource"`
    )
  })

  it('challenges a garbage token with invalid_token', async () => {
    const res = await listTools('Bearer not-a-token')
    expect(res.status).toBe(401)
    expect(res.headers.get('www-authenticate')).toBe(
      `Bearer resource_metadata="${BASE}/.well-known/oauth-protected-resource", error="invalid_token"`
    )
  })

  it('rejects a refresh token used as an access token', async () => {
    expect((await listTools(`Bearer ${connected.tokens.refresh_token}`)).status).toBe(401)
  })

  it('rejects a token signed for another resource', async () => {
    const { token } = await auth.api.signJWT({
      body: {
        payload: {
          sub: connected.user.userId,
          aud: `${BASE}/other`,
          azp: connected.client.client_id,
        },
      },
    })
    expect((await listTools(`Bearer ${token}`)).status).toBe(401)
  })

  it('rejects the access token after the connection is revoked', async () => {
    const { client, user, tokens } = await connect()
    revokeConnectedClient(user.userId, client.client_id)
    expect((await listTools(`Bearer ${tokens.access_token}`)).status).toBe(401)
  })

  it('rejects the refresh token after the connection is revoked', async () => {
    const { client, user, tokens } = await connect()
    revokeConnectedClient(user.userId, client.client_id)
    expect((await refresh(client.client_id, tokens.refresh_token)).status).toBe(400)
  })

  it('still accepts an API key', async () => {
    const { key } = createApiKey(connected.user.userId, 'Script')
    expect((await listTools(`Bearer ${key}`)).status).toBe(200)
  })
})
