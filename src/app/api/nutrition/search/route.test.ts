import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type NutritionResult, searchNutrition } from '@/lib/nutrition-sources'
import { getSession } from '@/lib/session'
import { sessionFor, type TestUser } from '@/test/db'
import { GET } from './route'

vi.mock('@/lib/session', () => ({ getSession: vi.fn() }))
vi.mock('@/lib/nutrition-sources', () => ({ searchNutrition: vi.fn() }))

const user: TestUser = {
  id: 'user-1',
  name: 'Ana',
  email: 'ana@example.com',
  emailVerified: false,
  image: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const oats: NutritionResult = {
  source: 'off',
  sourceId: '1',
  name: 'Oats',
  brand: null,
  per100g: { kcal: 380, protein: 13, carbs: 60, fat: 7, fiber: 10 },
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getSession).mockResolvedValue(sessionFor(user))
  vi.mocked(searchNutrition).mockResolvedValue([oats])
})

function get(query: string) {
  return GET(new NextRequest(`http://localhost/api/nutrition/search${query}`))
}

describe('GET /api/nutrition/search', () => {
  it('returns the search results as JSON', async () => {
    const res = await get('?q=oats')
    expect(await res.json()).toEqual([oats])
  })

  it('searches for the trimmed query', async () => {
    await get('?q=%20rolled%20oats%20')
    expect(searchNutrition).toHaveBeenCalledWith('rolled oats')
  })

  it('returns 400 without a query', async () => {
    expect((await get('')).status).toBe(400)
  })

  it('returns 400 for a blank query', async () => {
    expect((await get('?q=%20%20')).status).toBe(400)
  })

  it('returns 401 without a session', async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    expect((await get('?q=oats')).status).toBe(401)
  })

  it('does not search without a session', async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    await get('?q=oats')
    expect(searchNutrition).not.toHaveBeenCalled()
  })
})
