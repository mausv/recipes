import { describe, expect, it } from 'vitest'
import { setupTestDb } from '@/test/db'

const { db, schema, insertUser, insertGroup, insertRecipe, shareInto } = await setupTestDb()
const { getNote, saveNote } = await import('./notes')

const ana = insertUser()
const ben = insertUser()
const porridge = insertRecipe(ana.id)

describe('getNote', () => {
  it('returns only the user’s note', () => {
    db.insert(schema.recipeNote)
      .values({ recipeId: porridge.id, userId: ana.id, text: 'Mine' })
      .run()
    expect(getNote(ana.id, porridge.id)?.text).toBe('Mine')
    expect(getNote(ben.id, porridge.id)).toBeUndefined()
  })
})

describe('saveNote', () => {
  it('lets a member the recipe is shared with save a note', () => {
    const recipe = insertRecipe(ana.id)
    shareInto(recipe.id, insertGroup('Home', [ana.id, ben.id]).id, ana.id)
    expect(saveNote(ben.id, recipe.id, 'Less salt')).toEqual({})
    expect(getNote(ben.id, recipe.id)?.text).toBe('Less salt')
  })

  it('refuses a user who cannot see the recipe', () => {
    expect(saveNote(ben.id, insertRecipe(ana.id).id, 'Sneaky')).toEqual({
      error: 'Recipe not found',
    })
  })
})
