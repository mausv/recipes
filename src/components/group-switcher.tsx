'use client'

import { ChevronsUpDown, Settings2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { setActiveGroup } from '@/actions/groups'
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
import { useT, useTError } from '@/i18n/client'

export function GroupSwitcher({
  groups,
  activeId,
}: {
  groups: { id: string; name: string }[]
  activeId: string
}) {
  const router = useRouter()
  const t = useT()
  const tError = useTError()
  const [pending, startTransition] = useTransition()
  const active = groups.find((g) => g.id === activeId)

  function select(groupId: string) {
    startTransition(async () => {
      const result = await setActiveGroup(groupId)
      if (result.error !== undefined) toast.error(tError(result.error))
      else router.refresh()
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            className="-ml-2 max-w-44 min-w-0 text-muted-foreground"
          />
        }
      >
        <span className="truncate">{active?.name}</span>
        <ChevronsUpDown />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t.groups.title}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={activeId} onValueChange={select}>
            {groups.map((g) => (
              <DropdownMenuRadioItem key={g.id} value={g.id}>
                {g.name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/groups" />}>
          <Settings2 />
          {t.groups.manage}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
