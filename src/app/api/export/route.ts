import type { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { buildExport } from '@/lib/transfer'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return new Response('Unauthorized', { status: 401 })
  const params = request.nextUrl.searchParams
  const recipeId = params.get('recipe')
  const doc = await buildExport({
    userId: session.user.id,
    recipeIds: recipeId ? [recipeId] : undefined,
    includeImages: params.get('images') === '1',
  })
  if (recipeId && doc.recipes.length === 0) return new Response('Not found', { status: 404 })

  return Response.json(doc, {
    headers: {
      'Content-Disposition': `attachment; filename="recipes-${doc.exportedAt.slice(0, 10)}.json"`,
    },
  })
}
