import Link from 'next/link'
import { BottomNav, TopNav } from '@/components/app-nav'
import { Toaster } from '@/components/ui/sonner'
import { UserMenu } from '@/components/user-menu'
import { requireUser } from '@/lib/session'

export const instant = false

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const user = await requireUser()

  return (
    <>
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="mx-auto flex h-14 max-w-[1040px] items-center gap-8 px-4 md:px-6">
          <Link href="/" className="font-heading text-[22px] leading-none font-medium">
            Recipes
          </Link>
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
