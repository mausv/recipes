import { z } from 'zod'

export const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const
export type Slot = (typeof SLOTS)[number]

function isRealDate(value: string) {
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
}

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a valid date')
  .refine(isRealDate, 'Pick a valid date')

export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Pick a valid month')

const slotSchema = z.enum(SLOTS, 'Pick a meal')

const servingsSchema = z.number('Servings must be a number').positive('Servings must be > 0')

const noteSchema = z
  .string()
  .trim()
  .min(1, 'Write a note')
  .max(200, 'Keep the note to 200 characters')

export const addEntrySchema = z
  .object({
    date: dateSchema,
    slot: slotSchema,
    recipeId: z.string().min(1).nullable().default(null),
    servings: servingsSchema.nullable().default(null),
    note: noteSchema.nullable().default(null),
  })
  .refine((e) => (e.recipeId === null) !== (e.note === null), 'Pick a recipe or write a note')

export const updateEntrySchema = z
  .object({
    servings: servingsSchema.nullable().optional(),
    note: noteSchema.optional(),
  })
  .refine((e) => e.servings !== undefined || e.note !== undefined, 'Nothing to change')

export const moveEntrySchema = z.object({ date: dateSchema, slot: slotSchema })

export type AddEntryInput = z.input<typeof addEntrySchema>
export type AddEntryData = z.output<typeof addEntrySchema>
export type UpdateEntryInput = z.input<typeof updateEntrySchema>
export type UpdateEntryData = z.output<typeof updateEntrySchema>
export type MoveEntryInput = z.input<typeof moveEntrySchema>
export type MoveEntryData = z.output<typeof moveEntrySchema>
