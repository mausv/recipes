import { afterEach, describe, expect, it, vi } from 'vitest'
import { mapUsdaFood, searchUsda, type UsdaFood } from './usda'

const banana: UsdaFood = {
  fdcId: 173944,
  description: 'Bananas, raw',
  foodNutrients: [
    { nutrientNumber: '208', value: 89 },
    { nutrientNumber: '203', value: 1.09 },
    { nutrientNumber: '205', value: 22.8 },
    { nutrientNumber: '204', value: 0.33 },
    { nutrientNumber: '291', value: 2.6 },
    { nutrientNumber: '269', value: 12.2 },
  ],
}

describe('mapUsdaFood', () => {
  it('maps nutrients by their USDA nutrient numbers', () => {
    expect(mapUsdaFood(banana)).toEqual({
      source: 'usda',
      sourceId: '173944',
      name: 'Bananas, raw',
      brand: null,
      per100g: { kcal: 89, protein: 1.09, carbs: 22.8, fat: 0.33, fiber: 2.6 },
    })
  })

  it('uses the brand name of a branded food', () => {
    expect(
      mapUsdaFood({ ...banana, brandName: 'Chiquita', brandOwner: 'Chiquita Brands' })?.brand
    ).toBe('Chiquita')
  })

  it('falls back to the brand owner when there is no brand name', () => {
    expect(mapUsdaFood({ ...banana, brandOwner: 'Dole' })?.brand).toBe('Dole')
  })

  it('skips a food without an energy (208) nutrient', () => {
    const foodNutrients = banana.foodNutrients.filter((n) => n.nutrientNumber !== '208')
    expect(mapUsdaFood({ ...banana, foodNutrients })).toBeNull()
  })

  it('skips a food with a blank description', () => {
    expect(mapUsdaFood({ ...banana, description: ' ' })).toBeNull()
  })

  it('defaults missing protein, carbs and fat to zero', () => {
    const result = mapUsdaFood({ ...banana, foodNutrients: [{ nutrientNumber: '208', value: 10 }] })
    expect(result?.per100g).toMatchObject({ protein: 0, carbs: 0, fat: 0 })
  })

  it('leaves missing fiber as null', () => {
    const result = mapUsdaFood({ ...banana, foodNutrients: [{ nutrientNumber: '208', value: 10 }] })
    expect(result?.per100g.fiber).toBeNull()
  })
})

describe('searchUsda', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubFetch(body: unknown, status = 200) {
    const fetch = vi.fn<(url: URL, init?: RequestInit) => Promise<Response>>(async () =>
      Response.json(body, { status })
    )
    vi.stubGlobal('fetch', fetch)
    return fetch
  }

  const signal = new AbortController().signal

  it('queries FoodData Central with the API key and query', async () => {
    const fetch = stubFetch({ foods: [] })
    await searchUsda('banana', 'secret-key', signal)
    const url = fetch.mock.calls[0][0]
    expect(url.origin + url.pathname).toBe('https://api.nal.usda.gov/fdc/v1/foods/search')
    expect(url.searchParams.get('api_key')).toBe('secret-key')
    expect(url.searchParams.get('query')).toBe('banana')
  })

  it('limits results to ten Foundation, SR Legacy and Branded foods', async () => {
    const fetch = stubFetch({ foods: [] })
    await searchUsda('banana', 'key', signal)
    const params = fetch.mock.calls[0][0].searchParams
    expect(params.get('pageSize')).toBe('10')
    expect(params.get('dataType')).toBe('Foundation,SR Legacy,Branded')
  })

  it('passes the abort signal to fetch', async () => {
    const fetch = stubFetch({ foods: [] })
    await searchUsda('banana', 'key', signal)
    expect(fetch.mock.calls[0][1]?.signal).toBe(signal)
  })

  it('returns mapped foods and drops unusable ones', async () => {
    stubFetch({ foods: [banana, { fdcId: 1, description: 'Water', foodNutrients: [] }] })
    const results = await searchUsda('banana', 'key', signal)
    expect(results.map((r) => r.sourceId)).toEqual(['173944'])
  })

  it('throws when the API responds with an error status', async () => {
    stubFetch({}, 403)
    await expect(searchUsda('banana', 'bad-key', signal)).rejects.toThrow('USDA responded 403')
  })
})
