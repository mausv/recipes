import { en } from './en'
import { es } from './es'

export const locales = ['en', 'es'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'en'
export const LOCALE_COOKIE = 'locale'

export const localeNames: Record<Locale, string> = { en: 'English', es: 'Español' }

export const dictionaries = { en, es }
export type Dictionary = typeof en

export function isLocale(value: unknown): value is Locale {
  return locales.some((l) => l === value)
}

export function matchLocale(acceptLanguage: string | null) {
  const ranked = (acceptLanguage ?? '')
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';')
      const q = params.find((p) => p.trim().startsWith('q='))
      return { language: tag.split('-')[0].toLowerCase(), q: q ? Number(q.trim().slice(2)) : 1 }
    })
    .filter(({ q }) => q > 0)
    .sort((a, b) => b.q - a.q)
  return ranked.map((r) => r.language).find(isLocale) ?? defaultLocale
}
