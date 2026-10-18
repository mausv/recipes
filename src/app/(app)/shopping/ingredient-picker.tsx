'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useT } from '@/i18n/client'
import type { IngredientWithUnits } from '@/lib/ingredients'

export function IngredientPicker({
  library,
  value,
  onSelectAction,
  label,
  className,
  children,
}: {
  library: IngredientWithUnits[]
  value: string | null
  onSelectAction: (ingredient: IngredientWithUnits) => void
  label?: string
  className?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const t = useT()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button type="button" variant="outline" aria-label={label} className={className} />}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-72 max-w-[calc(100vw-2rem)] p-0" align="start">
        <Command
          filter={(_value, search, keywords) =>
            keywords?.join(' ').toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }
        >
          <CommandInput placeholder={t.shopping.searchIngredients} />
          <CommandList>
            <CommandEmpty>{t.shopping.noIngredientFound}</CommandEmpty>
            <CommandGroup>
              {library.map((i) => (
                <CommandItem
                  key={i.id}
                  value={i.id}
                  keywords={[i.name, i.brand ?? '']}
                  data-checked={i.id === value}
                  onSelect={() => {
                    onSelectAction(i)

                    setOpen(false)
                  }}
                >
                  <span className="truncate">
                    {i.name}
                    {i.brand && <span className="text-muted-foreground">, {i.brand}</span>}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
