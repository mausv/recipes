import { z } from 'zod'

export const groupSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(60, 'Name must be 60 characters or less'),
})

export type GroupInput = z.input<typeof groupSchema>
