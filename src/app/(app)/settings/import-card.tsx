'use client'

import { Upload } from 'lucide-react'
import { useState, useTransition } from 'react'
import { importRecipes } from '@/actions/transfer'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import type { ImportMode } from '@/lib/validation/transfer'

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

export function ImportCard() {
  const [mode, setMode] = useState<ImportMode>('merge')
  const [confirming, setConfirming] = useState<FormData>()
  const [result, setResult] = useState<Awaited<ReturnType<typeof importRecipes>>>()
  const [pending, startTransition] = useTransition()

  function run(data: FormData) {
    setConfirming(undefined)
    startTransition(async () => setResult(await importRecipes(data)))
  }

  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    data.set('mode', mode)
    if (mode === 'replace') setConfirming(data)
    else run(data)
  }

  return (
    <section className="max-w-2xl space-y-5">
      <div className="space-y-1">
        <h2 className="text-2xl">Import</h2>
        <p className="text-sm text-muted-foreground">Load recipes from a JSON export.</p>
      </div>
      <div>
        <form onSubmit={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="import-file">Export file</FieldLabel>
              <Input id="import-file" name="file" type="file" accept="application/json" required />
            </Field>
            <FieldSet>
              <FieldLegend variant="label">Mode</FieldLegend>
              <RadioGroup value={mode} onValueChange={setMode}>
                <Field orientation="horizontal">
                  <RadioGroupItem id="mode-merge" value="merge" />
                  <FieldLabel htmlFor="mode-merge">Merge into existing data</FieldLabel>
                </Field>
                <Field orientation="horizontal">
                  <RadioGroupItem id="mode-replace" value="replace" />
                  <FieldLabel htmlFor="mode-replace">Replace everything</FieldLabel>
                </Field>
              </RadioGroup>
              {mode === 'replace' && (
                <FieldDescription className="text-destructive">
                  Deletes all recipes, ingredients, photos, comments, notes, the shopping list and
                  the pantry before importing.
                </FieldDescription>
              )}
            </FieldSet>
            {result && 'error' in result && <FieldError>{result.error}</FieldError>}
            {result && !('error' in result) && (
              <p role="status">
                Imported {plural(result.recipes, 'recipe')},{' '}
                {plural(result.ingredients, 'new ingredient')} and {plural(result.images, 'image')}.
              </p>
            )}
            <Button type="submit" disabled={pending} className="w-fit">
              <Upload />
              {pending ? 'Importing…' : 'Import'}
            </Button>
          </FieldGroup>
        </form>
      </div>

      <Dialog
        open={confirming !== undefined}
        onOpenChange={(open) => !open && setConfirming(undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace everything?</DialogTitle>
            <DialogDescription>
              This permanently deletes all current recipes, ingredients, photos, comments, notes,
              the shopping list and the pantry, then imports the file.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button variant="destructive" onClick={() => confirming && run(confirming)}>
              Replace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
