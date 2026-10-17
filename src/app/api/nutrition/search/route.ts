import type { NextRequest } from 'next/server'
import { searchNutrition } from '@/lib/nutrition-sources'
import { getSession } from '@/lib/session'

export async function GET(request: NextRequest) {
  if (!(await getSession())) return new Response('Unauthorized', { status: 401 })
  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q) return Response.json({ error: 'Missing q' }, { status: 400 })
  return Response.json(await searchNutrition(q))
}
