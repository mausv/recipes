'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { isLocale, LOCALE_COOKIE } from '@/i18n'

export async function setLocale(locale: string) {
  if (!isLocale(locale)) return { error: 'Unsupported language' }
  const store = await cookies()
  store.set(LOCALE_COOKIE, locale, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 365 * 24 * 60 * 60,
    path: '/',
  })
  revalidatePath('/', 'layout')
  return {}
}
