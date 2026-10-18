'use client'

import { Download } from 'lucide-react'
import { useState } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldLabel } from '@/components/ui/field'
import { useT } from '@/i18n/client'

export function ExportCard() {
  const t = useT()
  const [images, setImages] = useState(true)

  return (
    <section className="max-w-2xl space-y-5">
      <div className="space-y-1">
        <h2 className="text-2xl">{t.settings.export}</h2>
        <p className="text-sm text-muted-foreground">{t.settings.exportDescription}</p>
      </div>
      <div className="space-y-4">
        <Field orientation="horizontal">
          <Checkbox id="include-images" checked={images} onCheckedChange={setImages} />
          <FieldLabel htmlFor="include-images">{t.settings.includeImages}</FieldLabel>
        </Field>
        <a href={images ? '/api/export?images=1' : '/api/export'} className={buttonVariants()}>
          <Download />
          {t.settings.downloadExport}
        </a>
      </div>
    </section>
  )
}
