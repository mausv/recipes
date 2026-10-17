import { afterEach, describe, expect, it, vi } from 'vitest'
import { mapOffProduct, OFF_USER_AGENT, type OffProduct, searchOff } from './off'

const nutella: OffProduct = {
  code: '3017620422003',
  product_name: 'Nutella',
  brands: 'Ferrero, Nutella',
  nutriments: {
    'energy-kcal_100g': 539,
    proteins_100g: 6.3,
    carbohydrates_100g: 57.5,
    fat_100g: 30.9,
    fiber_100g: 3.4,
  },
}

describe('mapOffProduct', () => {
  it('maps a complete product to a nutrition result', () => {
    expect(mapOffProduct(nutella)).toEqual({
      source: 'off',
      sourceId: '3017620422003',
      name: 'Nutella',
      brand: 'Ferrero',
      per100g: { kcal: 539, protein: 6.3, carbs: 57.5, fat: 30.9, fiber: 3.4 },
    })
  })

  it('keeps only the first of several comma-separated brands', () => {
    expect(mapOffProduct({ ...nutella, brands: 'Lidl,Milbona' })?.brand).toBe('Lidl')
  })

  it('returns a null brand when the product has none', () => {
    expect(mapOffProduct({ ...nutella, brands: undefined })?.brand).toBeNull()
  })

  it('trims the product name', () => {
    expect(mapOffProduct({ ...nutella, product_name: '  Nutella ' })?.name).toBe('Nutella')
  })

  it('skips a product without a name', () => {
    expect(mapOffProduct({ ...nutella, product_name: undefined })).toBeNull()
  })

  it('skips a product with a blank name', () => {
    expect(mapOffProduct({ ...nutella, product_name: '   ' })).toBeNull()
  })

  it('skips a product without kcal', () => {
    const { proteins_100g, fat_100g } = nutella.nutriments ?? {}
    expect(mapOffProduct({ ...nutella, nutriments: { proteins_100g, fat_100g } })).toBeNull()
  })

  it('skips a product without nutriments', () => {
    expect(mapOffProduct({ ...nutella, nutriments: undefined })).toBeNull()
  })

  it('defaults missing protein, carbs and fat to zero', () => {
    const result = mapOffProduct({ ...nutella, nutriments: { 'energy-kcal_100g': 40 } })
    expect(result?.per100g).toMatchObject({ protein: 0, carbs: 0, fat: 0 })
  })

  it('leaves missing fiber as null', () => {
    const result = mapOffProduct({ ...nutella, nutriments: { 'energy-kcal_100g': 40 } })
    expect(result?.per100g.fiber).toBeNull()
  })
})

describe('searchOff', () => {
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

  it('queries the Open Food Facts search endpoint with the search terms', async () => {
    const fetch = stubFetch({ products: [] })
    await searchOff('peanut butter', signal)
    const url = fetch.mock.calls[0][0]
    expect(url.origin + url.pathname).toBe('https://world.openfoodfacts.org/cgi/search.pl')
    expect(url.searchParams.get('search_terms')).toBe('peanut butter')
  })

  it('asks for JSON, ten results and only the needed fields', async () => {
    const fetch = stubFetch({ products: [] })
    await searchOff('oats', signal)
    const params = fetch.mock.calls[0][0].searchParams
    expect(params.get('json')).toBe('1')
    expect(params.get('page_size')).toBe('10')
    expect(params.get('fields')).toBe('code,product_name,brands,nutriments')
  })

  it('sends a User-Agent header', async () => {
    const fetch = stubFetch({ products: [] })
    await searchOff('oats', signal)
    expect(fetch.mock.calls[0][1]?.headers).toEqual({ 'User-Agent': OFF_USER_AGENT })
  })

  it('passes the abort signal to fetch', async () => {
    const fetch = stubFetch({ products: [] })
    await searchOff('oats', signal)
    expect(fetch.mock.calls[0][1]?.signal).toBe(signal)
  })

  it('returns mapped products and drops unusable ones', async () => {
    stubFetch({ products: [nutella, { code: '1', product_name: 'Mystery' }] })
    const results = await searchOff('nutella', signal)
    expect(results.map((r) => r.name)).toEqual(['Nutella'])
  })

  it('treats a non-numeric nutrient as missing', async () => {
    stubFetch({
      products: [{ ...nutella, nutriments: { ...nutella.nutriments, fiber_100g: 'n/a' } }],
    })
    const [result] = await searchOff('nutella', signal)
    expect(result.per100g.fiber).toBeNull()
  })

  it('throws when the API responds with an error status', async () => {
    stubFetch({}, 503)
    await expect(searchOff('oats', signal)).rejects.toThrow('Open Food Facts responded 503')
  })
})
