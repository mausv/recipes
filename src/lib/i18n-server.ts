import { cookies, headers } from 'next/headers'
import { dictionaries, isLocale, LOCALE_COOKIE, matchLocale } from '@/i18n'

export async function getLocale() {
  const cookie = (await cookies()).get(LOCALE_COOKIE)?.value
  if (isLocale(cookie)) return cookie
  return matchLocale((await headers()).get('accept-language'))
}

export async function getT() {
  return dictionaries[await getLocale()]
}
