export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-10">
        <p className="font-heading text-[32px] leading-none font-medium">Recipes</p>
        {children}
      </div>
    </main>
  )
}
