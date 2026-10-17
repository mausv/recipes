'use client'

import { Tabs } from '@/components/ui/tabs'

export function ShoppingTabs({
  defaultTab,
  children,
}: {
  defaultTab: string
  children: React.ReactNode
}) {
  return (
    <Tabs
      defaultValue={defaultTab}
      onValueChange={(tab) => window.history.replaceState(null, '', `?tab=${tab}`)}
    >
      {children}
    </Tabs>
  )
}
