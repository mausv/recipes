import fs from 'node:fs'
import { eq } from 'drizzle-orm'
import type { NextRequest } from 'next/server'
import { db } from '@/db'
import { image } from '@/db/schema'
import { canViewRecipe } from '@/lib/access'
import { imagePath } from '@/lib/images'
import { getSession } from '@/lib/session'

export async function GET(_request: NextRequest, ctx: RouteContext<'/api/images/[id]'>) {
  const session = await getSession()
  if (!session) return new Response('Unauthorized', { status: 401 })
  const { id } = await ctx.params
  const row = db
    .select({ id: image.id, recipeId: image.recipeId })
    .from(image)
    .where(eq(image.id, id))
    .get()
  const visible = row && (!row.recipeId || canViewRecipe(session.user.id, row.recipeId))
  if (!visible || !fs.existsSync(imagePath(row.id))) {
    return new Response('Not found', { status: 404 })
  }
  return new Response(await fs.openAsBlob(imagePath(row.id)), {
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  })
}
