import { describe, expect, it } from 'vitest'
import { setupTestDb } from '@/test/db'

const { db, schema, insertUser, insertGroup, insertRecipe, shareInto } = await setupTestDb()
const { addComment, listComments } = await import('./comments')

const ana = insertUser()
const ben = insertUser()
const outsider = insertUser()
const home = insertGroup('Home', [ana.id, ben.id])
const porridge = insertRecipe(ana.id)
shareInto(porridge.id, home.id, ana.id)

describe('listComments', () => {
  it('lists a recipe’s comments oldest first with the author name', () => {
    db.insert(schema.recipeComment)
      .values([
        { recipeId: porridge.id, userId: ana.id, text: 'Second', createdAt: new Date(2000) },
        { recipeId: porridge.id, userId: ana.id, text: 'First', createdAt: new Date(1000) },
      ])
      .run()
    expect(listComments(ana.id, porridge.id).map((c) => [c.text, c.user.name])).toEqual([
      ['First', 'Ana'],
      ['Second', 'Ana'],
    ])
  })

  it('shows the comments to a member the recipe is shared with', () => {
    expect(listComments(ben.id, porridge.id).length).toBeGreaterThan(0)
  })

  it('hides the comments from a user who cannot see the recipe', () => {
    expect(listComments(outsider.id, porridge.id)).toEqual([])
  })

  it('returns nothing for an unknown recipe', () => {
    expect(listComments(ana.id, 'missing')).toEqual([])
  })
})

describe('addComment', () => {
  it('lets a member the recipe is shared with comment', () => {
    expect(addComment(ben.id, porridge.id, 'Yum')).toHaveProperty('id')
  })

  it('refuses a user who cannot see the recipe', () => {
    expect(addComment(outsider.id, porridge.id, 'Yum')).toEqual({ error: 'Recipe not found' })
  })
})
