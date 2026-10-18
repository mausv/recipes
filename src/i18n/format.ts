import type { Locale } from '.'

const intlLocales: Record<Locale, string> = { en: 'en-US', es: 'es-MX' }

const spanishUnits = new Map([
  ['tsp', 'cdta'],
  ['tbsp', 'cda'],
  ['cup', 'taza'],
  ['fl oz', 'oz fl'],
])

export function intlLocale(locale: Locale) {
  return intlLocales[locale]
}

export function dateFormatter(locale: Locale, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(intlLocales[locale], options)
}

export function unitLabel(unit: string, locale: Locale) {
  return (locale === 'es' && spanishUnits.get(unit)) || unit
}
