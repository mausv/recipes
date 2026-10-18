'use client'

import Image from 'next/image'
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
import { formatKcal } from '@/lib/nutrition'
import { cn } from '@/lib/utils'

export type PickerRecipe = {
  id: string
  title: string
  servings: number
  coverImageId: string | null
  kcalPerServing: number
}

export function RecipeThumb({
  title,
  coverImageId,
  className,
}: {
  title: string
  coverImageId: string | null
  className?: string
}) {
  return (
    <span
      className={cn(
        'relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary font-heading text-lg leading-none font-medium text-primary uppercase',
        className
      )}
    >
      {coverImageId ? (
        <Image
          src={`/api/images/${coverImageId}`}
          alt=""
          fill
          unoptimized
          sizes="40px"
          className="object-cover"
        />
      ) : (
        <span aria-hidden>{title.charAt(0)}</span>
      )}
    </span>
  )
}

export function RecipePicker({
  recipes,
  value,
  onSelectAction,
  label,
  className,
  children,
}: {
  recipes: PickerRecipe[]
  value: string | null
  onSelectAction: (recipe: PickerRecipe) => void
  label?: string
  className?: string
  children: React.ReactNode
}) {
  const t = useT()
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button type="button" variant="outline" aria-label={label} className={className} />}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-80 max-w-[calc(100vw-2rem)] p-0" align="start">
        <Command
          filter={(_value, search, keywords) =>
            keywords?.join(' ').toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }
        >
          <CommandInput placeholder={t.recipes.search} />
          <CommandList>
            <CommandEmpty>{t.recipes.noRecipeFound}</CommandEmpty>
            <CommandGroup>
              {recipes.map((r) => (
                <CommandItem
                  key={r.id}
                  value={r.id}
                  keywords={[r.title]}
                  data-checked={r.id === value}
                  onSelect={() => {
                    onSelectAction(r)
                    setOpen(false)
                  }}
                >
                  <RecipeThumb title={r.title} coverImageId={r.coverImageId} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{r.title}</span>
                    <span className="block text-[13px] text-muted-foreground tabular-nums">
                      {t.recipes.kcalPerServing(formatKcal(r.kcalPerServing))}
                    </span>
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
