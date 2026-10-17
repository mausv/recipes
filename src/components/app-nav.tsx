'use client'

import { BookOpen, CalendarDays, Carrot, Settings, ShoppingCart } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const links = [
  { href: '/', label: 'Recipes', icon: BookOpen },
  { href: '/ingredients', label: 'Ingredients', icon: Carrot },
  { href: '/plan', label: 'Plan', icon: CalendarDays },
  { href: '/shopping', label: 'Shopping', icon: ShoppingCart },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const

function isActive(pathname: string, href: string) {
  return href === '/'
    ? pathname === '/' || pathname.startsWith('/recipes')
    : pathname.startsWith(href)
}

export function TopNav() {
  const pathname = usePathname()
  return (
    <nav className="hidden h-full items-stretch gap-6 md:flex">
      {links.map(({ href, label }) => {
        const active = isActive(pathname, href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative flex items-center text-[15px] text-muted-foreground transition-colors hover:text-foreground',
              active &&
                'text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-primary'
            )}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden">
      {links.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex h-14 flex-col items-center justify-center gap-1 text-[11px] leading-none text-muted-foreground',
              active && 'text-primary'
            )}
          >
            <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
