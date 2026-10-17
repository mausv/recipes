'use client'

import { Share2 } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { shareRecipe, unshareRecipe } from '@/actions/recipes'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldLabel } from '@/components/ui/field'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export function ShareButton({
  recipeId,
  groups,
}: {
  recipeId: string
  groups: { id: string; name: string; shared: boolean }[]
}) {
  const [shared, setShared] = useState(
    () => new Set(groups.filter((g) => g.shared).map((g) => g.id))
  )
  const [pending, startTransition] = useTransition()

  function toggle(groupId: string, checked: boolean) {
    startTransition(async () => {
      const action = checked ? shareRecipe : unshareRecipe
      const result = await action(recipeId, groupId)
      if (result.error !== undefined) {
        toast.error(result.error)
        return
      }
      setShared((current) => {
        const next = new Set(current)
        if (checked) next.add(groupId)
        else next.delete(groupId)
        return next
      })
    })
  }

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="ghost" />}>
        <Share2 />
        Share
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-3">
        <p className="text-sm text-muted-foreground">
          Members of these groups can see and cook from this recipe.
        </p>
        {groups.map((g) => (
          <Field key={g.id} orientation="horizontal">
            <Checkbox
              id={`share-${g.id}`}
              checked={shared.has(g.id)}
              disabled={pending}
              onCheckedChange={(checked) => toggle(g.id, checked)}
            />
            <FieldLabel htmlFor={`share-${g.id}`}>{g.name}</FieldLabel>
          </Field>
        ))}
      </PopoverContent>
    </Popover>
  )
}
