import fs from 'node:fs'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { pngBuffer, setupTestDb } from '@/test/db'

const { db, schema, dataDir, insertUser } = await setupTestDb()
const { deleteImage, deleteOrphanImages, imagePath, saveImage } = await import('./images')

const HOUR_MS = 60 * 60 * 1000

function findImage(id: string) {
  return db.select().from(schema.image).where(eq(schema.image.id, id)).get()
}

async function savedHoursAgo(hours: number, recipeId?: string) {
  const saved = await saveImage(await pngBuffer(), recipeId)
  db.update(schema.image)
    .set({ createdAt: new Date(Date.now() - hours * HOUR_MS) })
    .where(eq(schema.image.id, saved.id))
    .run()
  return saved.id
}

describe('imagePath', () => {
  it('points at a webp file named after the id inside DATA_DIR/images', () => {
    expect(imagePath('abc')).toBe(path.join(dataDir, 'images', 'abc.webp'))
  })
})

describe('saveImage', () => {
  it('writes the image to disk as webp', async () => {
    const saved = await saveImage(await pngBuffer())
    const { format } = await sharp(imagePath(saved.id)).metadata()
    expect(format).toBe('webp')
  })

  it('inserts an image row with the stored dimensions', async () => {
    const saved = await saveImage(await pngBuffer(40, 20))
    expect(findImage(saved.id)).toMatchObject({ width: 40, height: 20 })
  })

  it('returns the inserted row', async () => {
    const saved = await saveImage(await pngBuffer())
    expect(saved).toEqual(findImage(saved.id))
  })

  it('leaves the image unattached when no recipe is given', async () => {
    const saved = await saveImage(await pngBuffer())
    expect(saved.recipeId).toBeNull()
  })

  it('attaches the image to the given recipe', async () => {
    const recipe = db
      .insert(schema.recipe)
      .values({ title: 'Soup', createdById: insertUser().id })
      .returning()
      .get()
    const saved = await saveImage(await pngBuffer(), recipe.id)
    expect(saved.recipeId).toBe(recipe.id)
  })

  it('shrinks large images to fit within 1600 px, keeping the aspect ratio', async () => {
    const saved = await saveImage(await pngBuffer(3200, 1600))
    expect(saved).toMatchObject({ width: 1600, height: 800 })
  })

  it('does not enlarge small images', async () => {
    const saved = await saveImage(await pngBuffer(10, 10))
    expect(saved).toMatchObject({ width: 10, height: 10 })
  })

  it('applies the EXIF orientation', async () => {
    const rotated = await sharp(await pngBuffer(40, 20))
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer()
    const saved = await saveImage(rotated)
    expect(saved).toMatchObject({ width: 20, height: 40 })
  })

  it('rejects data that is not an image', async () => {
    await expect(saveImage(Buffer.from('not an image'))).rejects.toThrow()
  })
})

describe('deleteImage', () => {
  it('removes the file', async () => {
    const saved = await saveImage(await pngBuffer())
    await deleteImage(saved.id)
    expect(fs.existsSync(imagePath(saved.id))).toBe(false)
  })

  it('removes the row', async () => {
    const saved = await saveImage(await pngBuffer())
    await deleteImage(saved.id)
    expect(findImage(saved.id)).toBeUndefined()
  })

  it('succeeds when the file is already gone', async () => {
    const saved = await saveImage(await pngBuffer())
    fs.rmSync(imagePath(saved.id))
    await expect(deleteImage(saved.id)).resolves.toBeUndefined()
  })
})

describe('deleteOrphanImages', () => {
  it('removes the row of an unattached image older than a day', async () => {
    const id = await savedHoursAgo(25)
    await deleteOrphanImages()
    expect(findImage(id)).toBeUndefined()
  })

  it('removes the file of an unattached image older than a day', async () => {
    const id = await savedHoursAgo(25)
    await deleteOrphanImages()
    expect(fs.existsSync(imagePath(id))).toBe(false)
  })

  it('keeps an unattached image younger than a day', async () => {
    const id = await savedHoursAgo(23)
    await deleteOrphanImages()
    expect(findImage(id)).toBeDefined()
  })

  it('keeps an old image attached to a recipe', async () => {
    const recipe = db
      .insert(schema.recipe)
      .values({ title: 'Stew', createdById: insertUser().id })
      .returning()
      .get()
    const id = await savedHoursAgo(48, recipe.id)
    await deleteOrphanImages()
    expect(findImage(id)).toBeDefined()
  })

  it('uses the given age threshold', async () => {
    const id = await savedHoursAgo(2)
    await deleteOrphanImages(HOUR_MS)
    expect(findImage(id)).toBeUndefined()
  })
})
