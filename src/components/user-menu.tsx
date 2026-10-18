'use client'

import { LogOut, User } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { setLocale } from '@/actions/locale'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { localeNames, locales } from '@/i18n'
import { useLocale, useT, useTError } from '@/i18n/client'
import { authClient } from '@/lib/auth-client'

export function UserMenu({ name, email }: { name: string; email: string }) {
  const router = useRouter()
  const t = useT()
  const tError = useTError()
  const locale = useLocale()
  const [pending, startTransition] = useTransition()

  async function signOut() {
    await authClient.signOut()
    router.push('/login')
    router.refresh()
  }

  function selectLocale(value: string) {
    startTransition(async () => {
      const result = await setLocale(value)
      if (result.error !== undefined) toast.error(tError(result.error))
      else router.refresh()
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label={t.nav.userMenu} />}
      >
        <User />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <div className="text-foreground">{name}</div>
            <div className="font-normal">{email}</div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t.nav.language}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={locale} onValueChange={selectLocale}>
            {locales.map((l) => (
              <DropdownMenuRadioItem key={l} value={l} disabled={pending}>
                {localeNames[l]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut}>
          <LogOut />
          {t.nav.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
