import { AppIcon } from '@/components/app-icon'
import { Toaster } from '@/components/ui/sonner'
import { getT } from '@/lib/i18n-server'

export default async function AuthLayout({ children }: LayoutProps<'/'>) {
  const t = await getT()
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-10">
        <p className="flex items-center gap-3 font-heading text-[32px] leading-none font-medium">
          <AppIcon className="size-10" />
          {t.common.appName}
        </p>
        {children}
      </div>
      <Toaster />
    </main>
  )
}
