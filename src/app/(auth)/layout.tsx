import { AppIcon } from '@/components/app-icon'

export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-10">
        <p className="flex items-center gap-3 font-heading text-[32px] leading-none font-medium">
          <AppIcon className="size-10" />
          Recipes
        </p>
        {children}
      </div>
    </main>
  )
}
