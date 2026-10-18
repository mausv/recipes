import type { Metadata, Viewport } from 'next'
import { Figtree, Fraunces } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { I18nProvider } from '@/i18n/client'
import { getLocale, getT } from '@/lib/i18n-server'
import './globals.css'

const figtree = Figtree({ variable: '--font-figtree', subsets: ['latin'] })
const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
  style: ['normal', 'italic'],
  axes: ['SOFT', 'WONK', 'opsz'],
})

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return {
    title: t.common.appName,
    description: t.common.appDescription,
    appleWebApp: { title: t.common.appName, capable: true },
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbf8f2' },
    { media: '(prefers-color-scheme: dark)', color: '#1c1a17' },
  ],
}

export const instant = false

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const locale = await getLocale()
  return (
    <html
      lang={locale}
      className={`${figtree.variable} ${fraunces.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <I18nProvider locale={locale}>{children}</I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
