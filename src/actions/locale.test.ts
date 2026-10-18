import { revalidatePath } from 'next/cache'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setLocale } from './locale'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const setCookie = vi.hoisted(() => vi.fn())
vi.mock('next/headers', () => ({ cookies: async () => ({ set: setCookie }) }))

beforeEach(() => vi.clearAllMocks())

describe('setLocale', () => {
  it('stores the locale in a long-lived httpOnly cookie', async () => {
    expect(await setLocale('es')).toEqual({})
    expect(setCookie).toHaveBeenCalledWith('locale', 'es', {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 365 * 24 * 60 * 60,
      path: '/',
    })
  })

  it('revalidates every page', async () => {
    await setLocale('en')
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout')
  })

  it('refuses an unsupported locale', async () => {
    expect(await setLocale('fr')).toEqual({ error: 'Unsupported language' })
    expect(setCookie).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
