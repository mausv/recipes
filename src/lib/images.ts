import fs from 'node:fs/promises'
import path from 'node:path'
import { and, eq, isNull, lt } from 'drizzle-orm'
import sharp from 'sharp'
import { db, imagesDir } from '@/db'
import { image } from '@/db/schema'

const MAX_SIZE = 1600
const DAY_MS = 24 * 60 * 60 * 1000

export function imagePath(id: string) {
  return path.join(imagesDir, `${id}.webp`)
}

export async function saveImage(buffer: Buffer, recipeId?: string) {
  const id = crypto.randomUUID()
  const { data, info } = await sharp(buffer)
    .rotate()
    .resize(MAX_SIZE, MAX_SIZE, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer({ resolveWithObject: true })
  await fs.writeFile(imagePath(id), data)
  return db
    .insert(image)
    .values({ id, recipeId, width: info.width, height: info.height })
    .returning()
    .get()
}

export async function deleteImage(id: string) {
  db.delete(image).where(eq(image.id, id)).run()
  await fs.rm(imagePath(id), { force: true })
}

export async function deleteOrphanImages(olderThanMs = DAY_MS) {
  const orphans = db
    .select({ id: image.id })
    .from(image)
    .where(and(isNull(image.recipeId), lt(image.createdAt, new Date(Date.now() - olderThanMs))))
    .all()
  await Promise.all(orphans.map((row) => deleteImage(row.id)))
}
