import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { getLocale } from '@/lib/i18n-server'
import { renderRecipePdf } from '@/lib/pdf/document'
import { recipePdfModel } from '@/lib/pdf/model'
import { getRecipeWithNutrition } from '@/lib/recipes'
import { getSession } from '@/lib/session'

const paramsSchema = z.object({
  servings: z.coerce.number().int().min(1).max(999).optional(),
  mode: z.enum(['scale', 'split']).default('scale'),
})

function attachment(title: string) {
  const name =
    title
      .replace(/[\p{Cc}"\\/:*?<>|]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'recipe'
  const ascii =
    name
      .normalize('NFD')
      .replace(/[^\x20-\x7e]/g, '')
      .trim() || 'recipe'
  const encoded = encodeURIComponent(`${name}.pdf`).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  )
  return `attachment; filename="${ascii}.pdf"; filename*=UTF-8''${encoded}`
}

export async function GET(request: NextRequest, ctx: RouteContext<'/api/recipes/[id]/pdf'>) {
  const session = await getSession()
  if (!session) return new Response('Unauthorized', { status: 401 })
  const params = paramsSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!params.success) {
    return Response.json({ error: 'Invalid servings or mode' }, { status: 400 })
  }
  const { id } = await ctx.params
  const recipe = await getRecipeWithNutrition(id, session.user.id)
  if (!recipe) return new Response('Not found', { status: 404 })

  const model = recipePdfModel(recipe, {
    servings: params.data.servings ?? recipe.servings,
    mode: params.data.mode,
    locale: await getLocale(),
  })
  return new Response(new Uint8Array(await renderRecipePdf(model)), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': attachment(recipe.title),
    },
  })
}
