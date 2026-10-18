import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dictionaries } from '@/i18n'

const jar = vi.hoisted(() => new Map<string, string>())
const request = vi.hoisted(() => new Map<string, string>())
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
  }),
  headers: async () => ({ get: (name: string) => request.get(name) ?? null }),
}))

const { getLocale, getT } = await import('./i18n-server')

beforeEach(() => {
  jar.clear()
  request.clear()
})

describe('getLocale', () => {
  it('uses the locale cookie', async () => {
    jar.set('locale', 'es')
    request.set('accept-language', 'en-US')
    expect(await getLocale()).toBe('es')
  })

  it('lets the cookie override a Spanish browser', async () => {
    jar.set('locale', 'en')
    request.set('accept-language', 'es-MX,es;q=0.9')
    expect(await getLocale()).toBe('en')
  })

  it('ignores an unsupported cookie value', async () => {
    jar.set('locale', 'fr')
    request.set('accept-language', 'es-MX,es;q=0.9')
    expect(await getLocale()).toBe('es')
  })

  it('falls back to Accept-Language without a cookie', async () => {
    request.set('accept-language', 'es-MX,es;q=0.9')
    expect(await getLocale()).toBe('es')
  })

  it('defaults to English for an English, garbage or missing header', async () => {
    request.set('accept-language', 'en-US')
    expect(await getLocale()).toBe('en')
    request.set('accept-language', ';;;')
    expect(await getLocale()).toBe('en')
    request.clear()
    expect(await getLocale()).toBe('en')
  })
})

describe('getT', () => {
  it('returns the dictionary for the resolved locale', async () => {
    jar.set('locale', 'es')
    expect(await getT()).toBe(dictionaries.es)
  })
})
