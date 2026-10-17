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
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
          <Link href="/" className="font-semibold">
            Recipes
          </Link>
          <TopNav />
          <div className="ml-auto">
            <UserMenu name={user.name} email={user.email} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-24 md:pb-6">{children}</main>
      <BottomNav />
      <Toaster />
    </>
  )
}
