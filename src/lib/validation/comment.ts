import { z } from 'zod'

export const commentSchema = z.object({
  recipeId: z.string().min(1),
  text: z.string().trim().min(1, 'Comment cannot be empty'),
})

export type CommentInput = z.input<typeof commentSchema>
