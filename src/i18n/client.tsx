'use client'

import { createContext, use } from 'react'
import { defaultLocale, dictionaries, type Locale } from '.'
import { translateError } from './errors'

const LocaleContext = createContext<Locale>(defaultLocale)

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext value={locale}>{children}</LocaleContext>
}

export function useLocale() {
  return use(LocaleContext)
}

export function useT() {
  return dictionaries[useLocale()]
}

export function useTError() {
  const locale = useLocale()
  return (message: string) => translateError(message, locale)
}
