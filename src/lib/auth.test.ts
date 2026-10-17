import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'recipes-auth-'))
let handler: (request: Request) => Promise<Response>

beforeAll(async () => {
  vi.stubEnv('DATA_DIR', dataDir)
  vi.stubEnv('INVITE_CODE', 'open-sesame')
  vi.stubEnv('BETTER_AUTH_SECRET', 'test-secret-that-is-at-least-32-characters')
  vi.stubEnv('BETTER_AUTH_URL', 'http://localhost:3000')
  ;({ handler } = (await import('./auth')).auth)
})

afterAll(() => {
  vi.unstubAllEnvs()
  fs.rmSync(dataDir, { recursive: true, force: true })
})

function signUp(body: Record<string, string>) {
  return handler(
    new Request('http://localhost:3000/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify(body),
    })
  )
}

const account = { name: 'Ana', password: 'correct-horse-battery' }

describe('sign-up invite code hook', () => {
  it('rejects sign-up without an invite code', async () => {
    const res = await signUp({ ...account, email: 'none@example.com' })
    expect(res.status).toBe(403)
  })

  it('rejects sign-up with a wrong invite code', async () => {
    const res = await signUp({ ...account, email: 'wrong@example.com', inviteCode: 'nope' })
    expect(res.status).toBe(403)
  })

  it('creates the user when the invite code matches', async () => {
    const res = await signUp({ ...account, email: 'ok@example.com', inviteCode: 'open-sesame' })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ user: { email: 'ok@example.com' } })
  })

  it('sets a session cookie on successful sign-up', async () => {
    const res = await signUp({ ...account, email: 'cookie@example.com', inviteCode: 'open-sesame' })
    expect(res.headers.get('set-cookie')).toContain('better-auth.session_token=')
  })

  it('does not store the invite code on the user', async () => {
    const res = await signUp({ ...account, email: 'clean@example.com', inviteCode: 'open-sesame' })
    const { user } = await res.json()
    expect(user).not.toHaveProperty('inviteCode')
  })

  it('leaves sign-in unaffected by the invite code', async () => {
    const res = await handler(
      new Request('http://localhost:3000/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
        body: JSON.stringify({ email: 'ok@example.com', password: account.password }),
      })
    )
    expect(res.status).toBe(200)
  })
})

describe('sign-up group hook', () => {
  it('creates a personal group with the new user as admin', async () => {
    const res = await signUp({
      ...account,
      name: 'Ana María',
      email: 'group@example.com',
      inviteCode: 'open-sesame',
    })
    const { user } = await res.json()
    const { listGroups } = await import('./groups')
    expect(listGroups(user.id)).toEqual([
      expect.objectContaining({ name: 'Ana’s kitchen', role: 'admin', memberCount: 1 }),
    ])
  })
})
