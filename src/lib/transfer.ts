import fs from 'node:fs'
import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import sharp from 'sharp'
import { db } from '@/db'
import {
  image,
  ingredient,
  ingredientUnit,
  pantryItem,
  recipe,
  recipeComment,
  recipeIngredient,
  recipeNote,
  recipeStep,
  shoppingItem,
} from '@/db/schema'
import { imagePath } from '@/lib/images'
import { type ExportDoc, exportSchema, type ImportMode } from '@/lib/validation/transfer'

export class ImportError extends Error {}

export function parseExport(json: unknown) {
  const parsed = exportSchema.safeParse(json)
  if (parsed.success) return { doc: parsed.data }
  const [issue] = parsed.error.issues
  if (issue.path[0] === 'version') return { error: issue.message }
  const at = issue.path.length ? ` at ${issue.path.join('.')}` : ''
  return { error: `Invalid export file: ${issue.message}${at}` }
}

export async function buildExport({
  recipeIds,
  includeImages,
}: {
  recipeIds?: string[]
  includeImages: boolean
}): Promise<ExportDoc> {
  const recipes = await db.query.recipe.findMany({
    where: recipeIds && inArray(recipe.id, recipeIds),
    columns: { createdById: false, createdAt: false, updatedAt: false },
    orderBy: [asc(recipe.title), asc(recipe.id)],
    with: {
      ingredients: {
        columns: { id: false, recipeId: false },
        orderBy: asc(recipeIngredient.position),
      },
      steps: { columns: { id: false, recipeId: false }, orderBy: asc(recipeStep.position) },
      comments: {
        orderBy: asc(recipeComment.createdAt),
        with: { user: { columns: { name: true } } },
      },
      notes: { orderBy: asc(recipeNote.updatedAt), with: { user: { columns: { name: true } } } },
    },
  })

  const usedIngredientIds = [
    ...new Set(recipes.flatMap((r) => r.ingredients.map((l) => l.ingredientId))),
  ]
  const ingredients = await db.query.ingredient.findMany({
    where: recipeIds && inArray(ingredient.id, usedIngredientIds),
    columns: { createdById: false, createdAt: false, updatedAt: false },
    orderBy: asc(ingredient.name),
    with: { units: { columns: { name: true, grams: true }, orderBy: asc(ingredientUnit.name) } },
  })

  const imageIds = recipes
    .flatMap((r) => [r.coverImageId, ...r.steps.map((s) => s.imageId)])
    .filter((id) => id !== null)
  const images = includeImages
    ? await Promise.all(
        db
          .select({ id: image.id, width: image.width, height: image.height })
          .from(image)
          .where(inArray(image.id, imageIds))
          .all()
          .map(async (row) => ({
            ...row,
            data: (await fs.promises.readFile(imagePath(row.id))).toString('base64'),
          }))
      )
    : undefined

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    ingredients,
    recipes: recipes.map((r) => ({
      ...r,
      comments: r.comments.map((c) => ({
        authorName: c.user.name,
        text: c.text,
        createdAt: c.createdAt.toISOString(),
      })),
      notes: r.notes.map((n) => ({
        authorName: n.user.name,
        text: n.text,
        updatedAt: n.updatedAt.toISOString(),
      })),
    })),
    images,
  }
}

async function decodeImages(images: ExportDoc['images'] = []) {
  return Promise.all(
    images.map(async ({ id, data }) => {
      const buffer = Buffer.from(data, 'base64')
      const meta = await sharp(buffer)
        .metadata()
        .catch(() => null)
      if (meta?.format !== 'webp') throw new ImportError(`Image ${id} is not a valid WebP image`)
      return { id, buffer, width: meta.width, height: meta.height }
    })
  )
}

function nameKey({ name, brand }: { name: string; brand: string | null }) {
  return `${name.trim().toLowerCase()}\n${(brand ?? '').trim().toLowerCase()}`
}

export async function applyImport(
  doc: ExportDoc,
  { userId, mode }: { userId: string; mode: ImportMode }
) {
  const images = await decodeImages(doc.images)

  const { counts, removedImageIds } = db.transaction((tx) => {
    const removedImageIds: string[] = []
    if (mode === 'replace') {
      removedImageIds.push(
        ...tx
          .select({ id: image.id })
          .from(image)
          .all()
          .map((row) => row.id)
      )
      tx.delete(shoppingItem).run()
      tx.delete(pantryItem).run()
      tx.delete(recipe).run()
      tx.delete(image).run()
      tx.delete(ingredient).run()
    }

    const library = tx
      .select({ id: ingredient.id, name: ingredient.name, brand: ingredient.brand })
      .from(ingredient)
      .all()
    const knownIds = new Set(library.map((i) => i.id))
    const idsByName = new Map(library.map((i) => [nameKey(i), i.id]))
    const ingredientIds = new Map<string, string>()
    let addedIngredients = 0

    for (const { units, ...values } of doc.ingredients) {
      let id = knownIds.has(values.id) ? values.id : idsByName.get(nameKey(values))
      if (!id) {
        id = values.id
        tx.insert(ingredient)
          .values({ ...values, createdById: userId })
          .run()
        knownIds.add(id)
        idsByName.set(nameKey(values), id)
        addedIngredients++
      }
      if (units.length) {
        tx.insert(ingredientUnit)
          .values(units.map((u) => ({ ...u, ingredientId: id })))
          .onConflictDoNothing()
          .run()
      }
      ingredientIds.set(values.id, id)
    }

    const storedImageIds = new Set(
      tx
        .select({ id: image.id })
        .from(image)
        .all()
        .map((row) => row.id)
    )
    const newImages = images.filter((img) => !storedImageIds.has(img.id))
    if (newImages.length) {
      tx.insert(image)
        .values(newImages.map(({ id, width, height }) => ({ id, width, height })))
        .run()
    }
    const availableImageIds = new Set([...storedImageIds, ...newImages.map((img) => img.id)])
    const imageRef = (id: string | null) => (id && availableImageIds.has(id) ? id : null)

    for (const { id, ingredients: lines, steps, comments, notes, ...fields } of doc.recipes) {
      const values = { ...fields, coverImageId: imageRef(fields.coverImageId) }
      const exists = tx.select({ id: recipe.id }).from(recipe).where(eq(recipe.id, id)).get()
      if (exists) {
        tx.update(recipe).set(values).where(eq(recipe.id, id)).run()
        tx.delete(recipeIngredient).where(eq(recipeIngredient.recipeId, id)).run()
        tx.delete(recipeStep).where(eq(recipeStep.recipeId, id)).run()
      } else {
        tx.insert(recipe)
          .values({ id, ...values, createdById: userId })
          .run()
      }

      if (lines.length) {
        tx.insert(recipeIngredient)
          .values(
            lines.map((line) => {
              const ingredientId =
                ingredientIds.get(line.ingredientId) ??
                (knownIds.has(line.ingredientId) ? line.ingredientId : undefined)
              if (!ingredientId) {
                throw new ImportError(`"${fields.title}" uses an ingredient missing from the file`)
              }
              return { ...line, ingredientId, recipeId: id }
            })
          )
          .run()
      }
      const stepRows = steps.map((s) => ({ ...s, imageId: imageRef(s.imageId), recipeId: id }))
      if (stepRows.length) tx.insert(recipeStep).values(stepRows).run()

      const referenced = [values.coverImageId, ...stepRows.map((s) => s.imageId)].filter(
        (ref) => ref !== null
      )
      if (referenced.length) {
        tx.update(image)
          .set({ recipeId: id })
          .where(and(inArray(image.id, referenced), isNull(image.recipeId)))
          .run()
      }
      const unused = tx
        .select({ id: image.id })
        .from(image)
        .where(eq(image.recipeId, id))
        .all()
        .map((row) => row.id)
        .filter((imageId) => !referenced.includes(imageId))
      if (unused.length) {
        tx.delete(image).where(inArray(image.id, unused)).run()
        removedImageIds.push(...unused)
      }

      const seen = new Set(
        tx
          .select({ text: recipeComment.text, createdAt: recipeComment.createdAt })
          .from(recipeComment)
          .where(eq(recipeComment.recipeId, id))
          .all()
          .map((c) => `${c.createdAt.getTime()}\n${c.text}`)
      )
      const newComments = comments
        .map((c) => ({ text: c.text, createdAt: new Date(c.createdAt) }))
        .filter((c) => !seen.has(`${c.createdAt.getTime()}\n${c.text}`))
      if (newComments.length) {
        tx.insert(recipeComment)
          .values(newComments.map((c) => ({ ...c, recipeId: id, userId })))
          .run()
      }

      if (notes.length) {
        const text = notes.map((n) => n.text).join('\n\n')
        const updatedAt = new Date(Math.max(...notes.map((n) => Date.parse(n.updatedAt))))
        const current = tx
          .select({ updatedAt: recipeNote.updatedAt })
          .from(recipeNote)
          .where(and(eq(recipeNote.recipeId, id), eq(recipeNote.userId, userId)))
          .get()
        if (!current || current.updatedAt < updatedAt) {
          tx.insert(recipeNote)
            .values({ recipeId: id, userId, text, updatedAt })
            .onConflictDoUpdate({
              target: [recipeNote.recipeId, recipeNote.userId],
              set: { text, updatedAt },
            })
            .run()
        }
      }
    }

    return {
      removedImageIds,
      counts: {
        ingredients: addedIngredients,
        recipes: doc.recipes.length,
        images: newImages.length,
      },
    }
  })

  await Promise.all(removedImageIds.map((id) => fs.promises.rm(imagePath(id), { force: true })))
  await Promise.all(
    images
      .filter((img) => !fs.existsSync(imagePath(img.id)))
      .map((img) => fs.promises.writeFile(imagePath(img.id), img.buffer))
  )
  return counts
}

export async function importExport(json: unknown, options: { userId: string; mode: ImportMode }) {
  const parsed = parseExport(json)
  if (parsed.error !== undefined) return { error: parsed.error }
  try {
    return await applyImport(parsed.doc, options)
  } catch (error) {
    if (error instanceof ImportError) return { error: error.message }
    throw error
  }
}
