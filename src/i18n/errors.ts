import { errorPatterns, errors } from './es/errors'
import type { Locale } from '.'

export function translateError(message: string, locale: Locale) {
  if (locale === 'en') return message
  if (Object.hasOwn(errors, message)) return errors[message]
  for (const [pattern, translate] of errorPatterns) {
    const match = message.match(pattern)
    if (match) return translate(...match.slice(1))
  }
  return message
}
