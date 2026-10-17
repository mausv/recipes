'use client'

import { Download } from 'lucide-react'
import { useState } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldLabel } from '@/components/ui/field'

export function ExportCard() {
  const [images, setImages] = useState(true)

  return (
    <section className="max-w-2xl space-y-5">
      <div className="space-y-1">
        <h2 className="text-2xl">Export</h2>
        <p className="text-sm text-muted-foreground">
          Download your recipes and the ingredient library as a JSON file, including comments and
          your notes.
        </p>
      </div>
      <div className="space-y-4">
        <Field orientation="horizontal">
          <Checkbox id="include-images" checked={images} onCheckedChange={setImages} />
          <FieldLabel htmlFor="include-images">Include images</FieldLabel>
        </Field>
        <a href={images ? '/api/export?images=1' : '/api/export'} className={buttonVariants()}>
          <Download />
          Download export
        </a>
      </div>
    </section>
  )
}
