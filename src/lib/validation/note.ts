import { z } from 'zod'

export const noteSchema = z.object({
  recipeId: z.string().min(1),
  text: z.string().trim(),
})

export type NoteInput = z.input<typeof noteSchema>
