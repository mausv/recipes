import { describe, expect, it } from 'vitest'
import { setupTestDb } from '@/test/db'

const { db, schema, insertUser } = await setupTestDb()
const { listComments } = await import('./comments')

const ana = insertUser()
const porridge = db
  .insert(schema.recipe)
  .values({ title: 'Porridge', createdById: ana.id })
  .returning()
  .get()

describe('listComments', () => {
  it('lists a recipe’s comments oldest first with the author name', () => {
    db.insert(schema.recipeComment)
      .values([
        { recipeId: porridge.id, userId: ana.id, text: 'Second', createdAt: new Date(2000) },
        { recipeId: porridge.id, userId: ana.id, text: 'First', createdAt: new Date(1000) },
      ])
      .run()
    expect(listComments(porridge.id).map((c) => [c.text, c.user.name])).toEqual([
      ['First', 'Ana'],
      ['Second', 'Ana'],
    ])
  })

  it('returns nothing for an unknown recipe', () => {
    expect(listComments('missing')).toEqual([])
  })
})
