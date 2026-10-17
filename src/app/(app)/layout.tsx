import Link from 'next/link'
import { BottomNav, TopNav } from '@/components/app-nav'
import { GroupSwitcher } from '@/components/group-switcher'
import { Toaster } from '@/components/ui/sonner'
import { UserMenu } from '@/components/user-menu'
import { getActiveGroup } from '@/lib/active-group'
import { listGroups } from '@/lib/groups'
import { requireUser } from '@/lib/session'

export const instant = false

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const user = await requireUser()
  const activeGroup = await getActiveGroup(user.id)

  return (
    <>
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="mx-auto flex h-14 max-w-[1040px] items-center gap-4 px-4 md:gap-8 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" className="font-heading text-[22px] leading-none font-medium">
              Recipes
            </Link>
            <GroupSwitcher groups={listGroups(user.id)} activeId={activeGroup.id} />
          </div>
          <TopNav />
          <div className="-mr-2 ml-auto">
            <UserMenu name={user.name} email={user.email} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1040px] flex-1 px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] md:px-6 md:pt-10 md:pb-16">
        {children}
      </main>
      <BottomNav />
      <Toaster />
    </>
  )
}
