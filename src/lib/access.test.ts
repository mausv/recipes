import { describe, expect, it } from 'vitest'
import { setupTestDb } from '@/test/db'

const { insertUser, insertGroup, insertRecipe, shareInto } = await setupTestDb()
const { isRecipeOwner, canViewRecipe } = await import('./access')

const owner = insertUser()
const friend = insertUser()
const stranger = insertUser()
const outsider = insertUser()
const shared = insertGroup('Home', [owner.id, friend.id])
insertGroup('Elsewhere', [stranger.id, owner.id])
insertGroup('Alone', [outsider.id])
const recipe = insertRecipe(owner.id)
shareInto(recipe.id, shared.id, owner.id)
const privateRecipe = insertRecipe(owner.id)

describe('canViewRecipe', () => {
  it('lets the owner view their recipe', () => {
    expect(canViewRecipe(owner.id, privateRecipe.id)).toBe(true)
  })

  it('lets a member of a group the recipe is shared into view it', () => {
    expect(canViewRecipe(friend.id, recipe.id)).toBe(true)
  })

  it('hides the recipe from a member of another of the owner’s groups', () => {
    expect(canViewRecipe(stranger.id, recipe.id)).toBe(false)
  })

  it('hides the recipe from a user in no shared group', () => {
    expect(canViewRecipe(outsider.id, recipe.id)).toBe(false)
  })

  it('hides an unshared recipe from group members', () => {
    expect(canViewRecipe(friend.id, privateRecipe.id)).toBe(false)
  })

  it('returns false for an unknown recipe', () => {
    expect(canViewRecipe(owner.id, 'missing')).toBe(false)
  })
})

describe('isRecipeOwner', () => {
  it('is true for the owner', () => {
    expect(isRecipeOwner(owner.id, recipe.id)).toBe(true)
  })

  it('is false for a member the recipe is shared with', () => {
    expect(isRecipeOwner(friend.id, recipe.id)).toBe(false)
  })

  it('is false for an outsider', () => {
    expect(isRecipeOwner(outsider.id, recipe.id)).toBe(false)
  })
})
