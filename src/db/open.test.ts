import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import Database from 'better-sqlite3'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { afterEach, describe, expect, it } from 'vitest'
import { openDatabase } from './open'

const migrationsFolder = path.join(import.meta.dirname, 'migrations')
const openModule = path.join(import.meta.dirname, 'open.ts')
const run = promisify(execFile)
const migrationTotal = readMigrationFiles({ migrationsFolder }).length

let dataDir: string

afterEach(() => {
  fs.rmSync(dataDir, { recursive: true, force: true })
})

function freshDbFile() {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'recipes-open-'))
  return path.join(dataDir, 'recipes.db')
}

function openInChildProcess(file: string) {
  return run(
    process.execPath,
    [
      '--experimental-strip-types',
      '--no-warnings',
      '--input-type=module',
      '-e',
      `import { openDatabase } from ${JSON.stringify(openModule)}; openDatabase(process.argv[1], process.argv[2])`,
      file,
      migrationsFolder,
    ],
    { cwd: process.cwd() }
  )
}

function migrationCount(file: string) {
  const sqlite = new Database(file, { readonly: true })
  const count = sqlite.prepare('select count(*) from __drizzle_migrations').pluck().get()

  sqlite.close()
  return count
}

describe('openDatabase', () => {
  it('applies migrations to a fresh database', () => {
    const sqlite = openDatabase(freshDbFile(), migrationsFolder)
    const tables = sqlite
      .prepare<[], { name: string }>("select name from sqlite_master where type = 'table'")
      .all()
      .map((row) => row.name)
    sqlite.close()
    expect(tables).toEqual(expect.arrayContaining(['account', 'recipe', '__drizzle_migrations']))
  })

  it('does not reapply migrations when opened again', () => {
    const file = freshDbFile()
    openDatabase(file, migrationsFolder).close()
    openDatabase(file, migrationsFolder).close()
    expect(migrationCount(file)).toBe(migrationTotal)
  })

  it('records each migration once when several processes open a fresh database concurrently', async () => {
    const file = freshDbFile()
    await Promise.all(Array.from({ length: 4 }, () => openInChildProcess(file)))
    expect(migrationCount(file)).toBe(migrationTotal)
  })
})
