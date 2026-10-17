import Database from 'better-sqlite3'
import { readMigrationFiles } from 'drizzle-orm/migrator'

// Mirrors drizzle's SQLite migrator, but checks and applies pending migrations inside one
// BEGIN IMMEDIATE transaction so concurrent processes (e.g. build workers) can't both apply them.
function migrate(sqlite: Database.Database, migrationsFolder: string) {
  const migrations = readMigrationFiles({ migrationsFolder })
  sqlite
    .transaction(() => {
      sqlite.exec(
        'CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)'
      )
      const last = sqlite
        .prepare<[], { created_at: number }>(
          'SELECT created_at FROM "__drizzle_migrations" ORDER BY created_at DESC LIMIT 1'
        )
        .get()
      const record = sqlite.prepare<[string, number]>(
        'INSERT INTO "__drizzle_migrations" ("hash", "created_at") VALUES (?, ?)'
      )
      for (const migration of migrations) {
        if (last && Number(last.created_at) >= migration.folderMillis) continue
        for (const statement of migration.sql) sqlite.exec(statement)
        record.run(migration.hash, migration.folderMillis)
      }
    })
    .immediate()
}

export function openDatabase(file: string, migrationsFolder: string) {
  const sqlite = new Database(file, { timeout: 10_000 })
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  migrate(sqlite, migrationsFolder)
  return sqlite
}
