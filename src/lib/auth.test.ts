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

function post(path: string, body: Record<string, unknown>, cookie?: string) {
  return handler(
    new Request(`http://localhost:3000/api/auth${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost:3000',
        ...(cookie && { cookie }),
      },
      body: JSON.stringify(body),
    })
  )
}

function sessionCookie(res: Response) {
  return res.headers.get('set-cookie')?.match(/better-auth\.session_token=[^;]+/)?.[0] ?? ''
}

function getSession(cookie: string) {
  return handler(new Request('http://localhost:3000/api/auth/get-session', { headers: { cookie } }))
}

describe('password reset', () => {
  const email = 'reset@example.com'

  async function requestResetLink() {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const res = await post('/request-password-reset', { email, redirectTo: '/reset-password' })
    const lines = info.mock.calls.map((args) => args.join(' '))
    info.mockRestore()
    return { res, lines }
  }

  beforeAll(async () => {
    await signUp({ ...account, email, inviteCode: 'open-sesame' })
  })

  it('logs the email and reset URL on one line instead of emailing', async () => {
    const { res, lines } = await requestResetLink()
    expect(res.status).toBe(200)
    expect(lines).toEqual([
      expect.stringMatching(
        /^\[password-reset\] reset@example\.com http:\/\/localhost:3000\/api\/auth\/reset-password\/\w+\?callbackURL=%2Freset-password$/
      ),
    ])
  })

  it('answers unknown emails the same way without logging a link', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const res = await post('/request-password-reset', {
      email: 'nobody@example.com',
      redirectTo: '/reset-password',
    })
    expect(info).not.toHaveBeenCalled()
    info.mockRestore()
    const known = await requestResetLink()
    expect(await res.json()).toEqual(await known.res.json())
  })

  it('redirects the logged link to the reset page with the token', async () => {
    const { lines } = await requestResetLink()
    const url = lines[0].split(' ')[2]
    const res = await handler(new Request(url))
    const token = new URL(url).pathname.split('/').pop()
    expect(res.headers.get('location')).toBe(`http://localhost:3000/reset-password?token=${token}`)
  })

  it('redirects an unknown token to the reset page with an error', async () => {
    const res = await handler(
      new Request(
        'http://localhost:3000/api/auth/reset-password/bogus?callbackURL=%2Freset-password'
      )
    )
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/reset-password?error=INVALID_TOKEN'
    )
  })

  it('sets the new password, revokes sessions and consumes the token', async () => {
    const signIn = await post('/sign-in/email', { email, password: account.password })
    const cookie = sessionCookie(signIn)
    const { lines } = await requestResetLink()
    const token = new URL(lines[0].split(' ')[2]).pathname.split('/').pop()

    const res = await post('/reset-password', { newPassword: 'brand-new-password', token })
    expect(res.status).toBe(200)
    expect(await (await getSession(cookie)).json()).toBeNull()

    const oldLogin = await post('/sign-in/email', { email, password: account.password })
    expect(oldLogin.status).toBe(401)
    const newLogin = await post('/sign-in/email', { email, password: 'brand-new-password' })
    expect(newLogin.status).toBe(200)

    const reuse = await post('/reset-password', { newPassword: 'another-password', token })
    expect(await reuse.json()).toMatchObject({ code: 'INVALID_TOKEN', message: 'Invalid token' })
  })
})

describe('change password', () => {
  const email = 'change@example.com'

  beforeAll(async () => {
    await signUp({ ...account, email, inviteCode: 'open-sesame' })
  })

  it('rejects a wrong current password', async () => {
    const cookie = sessionCookie(
      await post('/sign-in/email', { email, password: account.password })
    )
    const res = await post(
      '/change-password',
      { currentPassword: 'wrong-password', newPassword: 'changed-password' },
      cookie
    )
    expect(await res.json()).toMatchObject({ message: 'Invalid password' })
  })

  it('changes the password and signs out other sessions', async () => {
    const other = sessionCookie(await post('/sign-in/email', { email, password: account.password }))
    const current = sessionCookie(
      await post('/sign-in/email', { email, password: account.password })
    )
    const res = await post(
      '/change-password',
      {
        currentPassword: account.password,
        newPassword: 'changed-password',
        revokeOtherSessions: true,
      },
      current
    )
    expect(res.status).toBe(200)
    expect(await (await getSession(other)).json()).toBeNull()
    expect(await (await getSession(sessionCookie(res))).json()).toMatchObject({ user: { email } })
    const login = await post('/sign-in/email', { email, password: 'changed-password' })
    expect(login.status).toBe(200)
  })
})
