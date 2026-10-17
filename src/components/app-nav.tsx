'use client'

import { BookOpen, Carrot, Settings, ShoppingCart } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const links = [
  { href: '/', label: 'Recipes', icon: BookOpen },
  { href: '/ingredients', label: 'Ingredients', icon: Carrot },
  { href: '/shopping', label: 'Shopping', icon: ShoppingCart },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href)
}

export function TopNav() {
  const pathname = usePathname()
  return (
    <nav className="hidden items-center gap-1 md:flex">
      {links.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground',
            isActive(pathname, href) && 'bg-muted text-foreground'
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden">
      {links.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            'flex flex-col items-center gap-1 py-2 text-xs text-muted-foreground',
            isActive(pathname, href) && 'text-foreground'
          )}
        >
          <Icon className="size-5" />
          {label}
        </Link>
      ))}
    </nav>
  )
}
