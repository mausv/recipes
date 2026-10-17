'use client'

import { Download } from 'lucide-react'
import { useState } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldLabel } from '@/components/ui/field'

export function ExportCard() {
  const [images, setImages] = useState(true)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export</CardTitle>
        <CardDescription>
          Download every recipe and ingredient as a JSON file, including comments and notes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field orientation="horizontal">
          <Checkbox id="include-images" checked={images} onCheckedChange={setImages} />
          <FieldLabel htmlFor="include-images">Include images</FieldLabel>
        </Field>
        <a href={images ? '/api/export?images=1' : '/api/export'} className={buttonVariants()}>
          <Download />
          Download export
        </a>
      </CardContent>
    </Card>
  )
}
