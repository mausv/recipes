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
import { useT, useTError } from '@/i18n/client'
import type { ImportMode } from '@/lib/validation/transfer'

export function ImportCard() {
  const t = useT()
  const tError = useTError()
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
        <h2 className="text-2xl">{t.settings.import}</h2>
        <p className="text-sm text-muted-foreground">{t.settings.importDescription}</p>
      </div>
      <div>
        <form onSubmit={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="import-file">{t.settings.exportFile}</FieldLabel>
              <Input id="import-file" name="file" type="file" accept="application/json" required />
            </Field>
            <FieldSet>
              <FieldLegend variant="label">{t.settings.mode}</FieldLegend>
              <RadioGroup value={mode} onValueChange={setMode}>
                <Field orientation="horizontal">
                  <RadioGroupItem id="mode-merge" value="merge" />
                  <FieldLabel htmlFor="mode-merge">{t.settings.merge}</FieldLabel>
                </Field>
                <Field orientation="horizontal">
                  <RadioGroupItem id="mode-replace" value="replace" />
                  <FieldLabel htmlFor="mode-replace">{t.settings.replace}</FieldLabel>
                </Field>
              </RadioGroup>
              {mode === 'replace' && (
                <FieldDescription className="text-destructive">
                  {t.settings.replaceWarning}
                </FieldDescription>
              )}
            </FieldSet>
            {result && 'error' in result && <FieldError>{tError(result.error)}</FieldError>}
            {result && !('error' in result) && (
              <p role="status">
                {t.settings.imported(result.recipes, result.ingredients, result.images)}
              </p>
            )}
            <Button type="submit" disabled={pending} className="w-fit">
              <Upload />
              {pending ? t.settings.importing : t.settings.import}
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
            <DialogTitle>{t.settings.replaceTitle}</DialogTitle>
            <DialogDescription>{t.settings.replaceDescription}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{t.common.cancel}</DialogClose>
            <Button variant="destructive" onClick={() => confirming && run(confirming)}>
              {t.settings.replaceConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
