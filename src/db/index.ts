import fs from 'node:fs'
import path from 'node:path'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { openDatabase } from './open'
import * as schema from './schema'

export const dataDir = path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR ?? 'data')
export const imagesDir = path.join(dataDir, 'images')
export const migrationsFolder = path.join(process.cwd(), 'src/db/migrations')

fs.mkdirSync(imagesDir, { recursive: true })

export const db = drizzle({
  client: openDatabase(path.join(dataDir, 'recipes.db'), migrationsFolder),
  schema,
})
