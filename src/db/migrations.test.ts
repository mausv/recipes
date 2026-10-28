import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type Database from 'better-sqlite3'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { openDatabase } from './open'

const migrationsFolder = path.join(import.meta.dirname, 'migrations')
const HOME_ID = 'dfcab55f-7c6c-48b7-b2f7-5935e7435987'

let dir: string

// Copies the migrations folder with the journal cut off after `tag`.
function migrationsUpTo(tag: string) {
  const folder = path.join(dir, `migrations-${tag}`)
  fs.cpSync(migrationsFolder, folder, { recursive: true })
  const journalPath = path.join(folder, 'meta', '_journal.json')
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'))
  const end = journal.entries.findIndex((e: { tag: string }) => e.tag === tag) + 1
  journal.entries = journal.entries.slice(0, end)
  fs.writeFileSync(journalPath, JSON.stringify(journal))
  return folder
}

function all(sqlite: Database.Database, query: string) {
  return sqlite.prepare(query).all()
}

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'recipes-migrations-'))
})

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('0003_groups', () => {
  let sqlite: Database.Database

  beforeAll(() => {
    const file = path.join(dir, 'seeded.db')
    const before = openDatabase(file, migrationsUpTo('0002_oauth'))
    before.exec(`
      insert into user (id, name, email, created_at) values
        ('u1', 'Ana', 'ana@example.com', 1000),
        ('u2', 'Ben', 'ben@example.com', 2000);
      insert into ingredient (id, name, kcal, protein, carbs, fat, created_by_id)
        values ('i1', 'Oats', 380, 13, 60, 7, 'u1');
      insert into recipe (id, title, created_by_id) values ('r1', 'Porridge', 'u2');
      insert into shopping_item (id, name, ingredient_id, recipe_id) values ('s1', 'Oats', 'i1', 'r1');
      insert into pantry_item (id, ingredient_id, grams) values ('p1', 'i1', 500);
    `)
    before.close()
    sqlite = openDatabase(file, migrationsFolder)
  })

  afterAll(() => sqlite.close())

  it('creates the Home group owned by the earliest user', () => {
    expect(all(sqlite, 'select id, name, created_by_id from "group"')).toEqual([
      { id: HOME_ID, name: 'Home', created_by_id: 'u1' },
    ])
  })

  it('adds every existing user to Home as an admin', () => {
    expect(
      all(sqlite, 'select group_id, user_id, role from group_member order by user_id')
    ).toEqual([
      { group_id: HOME_ID, user_id: 'u1', role: 'admin' },
      { group_id: HOME_ID, user_id: 'u2', role: 'admin' },
    ])
  })

  it('shares every existing recipe into Home', () => {
    expect(all(sqlite, 'select recipe_id, group_id, shared_by_id from recipe_share')).toEqual([
      { recipe_id: 'r1', group_id: HOME_ID, shared_by_id: 'u2' },
    ])
  })

  it('moves the shopping list into Home, keeping its rows', () => {
    expect(all(sqlite, 'select id, group_id, name, recipe_id from shopping_item')).toEqual([
      { id: 's1', group_id: HOME_ID, name: 'Oats', recipe_id: 'r1' },
    ])
  })

  it('moves the pantry into Home, keeping its rows', () => {
    expect(all(sqlite, 'select id, group_id, grams from pantry_item')).toEqual([
      { id: 'p1', group_id: HOME_ID, grams: 500 },
    ])
  })

  it('leaves no foreign key violations', () => {
    expect(sqlite.pragma('foreign_key_check')).toEqual([])
  })

  it('allows the same pantry ingredient in different groups', () => {
    sqlite.exec(`
      insert into "group" (id, name, created_by_id) values ('g2', 'Cabin', 'u1');
      insert into pantry_item (id, group_id, ingredient_id) values ('p2', 'g2', 'i1');
    `)
    expect(all(sqlite, "select id from pantry_item where ingredient_id = 'i1'")).toHaveLength(2)
  })
})

describe('0003_groups on an empty database', () => {
  it('creates no groups', () => {
    const sqlite = openDatabase(path.join(dir, 'empty.db'), migrationsFolder)
    expect(all(sqlite, 'select * from "group"')).toEqual([])
    sqlite.close()
  })
})

describe('0005_image_focus', () => {
  it('centres the focus of existing cover and step photos', () => {
    const file = path.join(dir, 'focus.db')
    const before = openDatabase(file, migrationsUpTo('0004_ingredient_category'))
    before.exec(`
      insert into user (id, name, email) values ('u1', 'Ana', 'ana@example.com');
      insert into image (id, width, height) values ('img1', 10, 10);
      insert into recipe (id, title, cover_image_id, created_by_id) values ('r1', 'Toast', 'img1', 'u1');
      insert into recipe_step (id, recipe_id, text, image_id, position) values ('s1', 'r1', 'Plate', 'img1', 0);
    `)
    before.close()
    const sqlite = openDatabase(file, migrationsFolder)
    expect(all(sqlite, 'select cover_focus_x, cover_focus_y from recipe')).toEqual([
      { cover_focus_x: 50, cover_focus_y: 50 },
    ])
    expect(all(sqlite, 'select image_focus_x, image_focus_y from recipe_step')).toEqual([
      { image_focus_x: 50, image_focus_y: 50 },
    ])
    sqlite.close()
  })
})
