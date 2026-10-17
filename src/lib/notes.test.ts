import { describe, expect, it } from 'vitest'
import { setupTestDb } from '@/test/db'

const { db, schema, insertUser } = await setupTestDb()
const { getNote } = await import('./notes')

const ana = insertUser()
const porridge = db
  .insert(schema.recipe)
  .values({ title: 'Porridge', createdById: ana.id })
  .returning()
  .get()

describe('getNote', () => {
  it('returns only the user’s note', () => {
    const ben = insertUser()
    db.insert(schema.recipeNote)
      .values({ recipeId: porridge.id, userId: ana.id, text: 'Mine' })
      .run()
    expect(getNote(ana.id, porridge.id)?.text).toBe('Mine')
    expect(getNote(ben.id, porridge.id)).toBeUndefined()
  })
})
