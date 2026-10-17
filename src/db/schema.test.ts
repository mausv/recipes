import path from 'node:path'
import Database from 'better-sqlite3'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { beforeAll, describe, expect, it } from 'vitest'
import * as schema from './schema'

const sqlite = new Database(':memory:')
sqlite.pragma('foreign_keys = ON')
const db = drizzle({ client: sqlite, schema })

beforeAll(() => {
  migrate(db, { migrationsFolder: path.join(import.meta.dirname, 'migrations') })
})

function tableNames() {
  return sqlite
    .prepare<[], { name: string }>("select name from sqlite_master where type = 'table'")
    .all()
    .map((row) => row.name)
}

function insertUser() {
  return db
    .insert(schema.user)
    .values({ id: crypto.randomUUID(), name: 'Ana', email: `${crypto.randomUUID()}@example.com` })
    .returning()
    .get()
}

function insertIngredient(createdById: string) {
  return db
    .insert(schema.ingredient)
    .values({ name: 'Oats', kcal: 380, protein: 13, carbs: 60, fat: 7, createdById })
    .returning()
    .get()
}

describe('migrations', () => {
  it.each([
    'user',
    'session',
    'account',
    'verification',
    'ingredient',
    'ingredient_unit',
    'recipe',
    'recipe_ingredient',
    'recipe_step',
    'image',
    'recipe_comment',
    'recipe_note',
    'shopping_item',
    'pantry_item',
  ])('creates the %s table', (table) => {
    expect(tableNames()).toContain(table)
  })
})

describe('schema defaults', () => {
  it('generates a UUID id for domain rows', () => {
    const ingredient = insertIngredient(insertUser().id)
    expect(ingredient.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('defaults ingredient density to 1 and source to manual', () => {
    const ingredient = insertIngredient(insertUser().id)
    expect(ingredient).toMatchObject({ density: 1, source: 'manual', fiber: null })
  })

  it('defaults recipe servings to 1 and tags to an empty array', () => {
    const recipe = db
      .insert(schema.recipe)
      .values({ title: 'Porridge', createdById: insertUser().id })
      .returning()
      .get()
    expect(recipe).toMatchObject({ servings: 1, tags: [] })
  })

  it('stores timestamps as dates', () => {
    const recipe = db
      .insert(schema.recipe)
      .values({ title: 'Toast', createdById: insertUser().id })
      .returning()
      .get()
    expect(recipe.createdAt).toBeInstanceOf(Date)
  })
})

describe('schema constraints', () => {
  it('rejects a duplicate unit name for the same ingredient', () => {
    const { id: ingredientId } = insertIngredient(insertUser().id)
    db.insert(schema.ingredientUnit).values({ ingredientId, name: 'cup', grams: 90 }).run()
    expect(() =>
      db.insert(schema.ingredientUnit).values({ ingredientId, name: 'cup', grams: 80 }).run()
    ).toThrow(/UNIQUE/)
  })

  it('cascades recipe deletion to its steps', () => {
    const recipe = db
      .insert(schema.recipe)
      .values({ title: 'Soup', createdById: insertUser().id })
      .returning()
      .get()
    db.insert(schema.recipeStep).values({ recipeId: recipe.id, text: 'Boil', position: 0 }).run()
    db.delete(schema.recipe).where(eq(schema.recipe.id, recipe.id)).run()
    expect(db.select().from(schema.recipeStep).all()).toEqual([])
  })

  it('prevents deleting an ingredient used by a recipe', () => {
    const userId = insertUser().id
    const ingredient = insertIngredient(userId)
    const recipe = db
      .insert(schema.recipe)
      .values({ title: 'Oat bars', createdById: userId })
      .returning()
      .get()
    db.insert(schema.recipeIngredient)
      .values({
        recipeId: recipe.id,
        ingredientId: ingredient.id,
        quantity: 100,
        unit: 'g',
        grams: 100,
        position: 0,
      })
      .run()
    expect(() =>
      db.delete(schema.ingredient).where(eq(schema.ingredient.id, ingredient.id)).run()
    ).toThrow(/FOREIGN KEY/)
  })
})
