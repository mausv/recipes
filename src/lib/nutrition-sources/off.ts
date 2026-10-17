import { z } from 'zod'
import type { NutritionResult } from './types'

export const OFF_USER_AGENT = 'Recipes/0.1 (self-hosted household recipe app)'

const nutrient = z.number().nullish().catch(null)

const offProduct = z.object({
  code: z.string(),
  product_name: z.string().optional(),
  brands: z.string().optional(),
  nutriments: z
    .object({
      'energy-kcal_100g': nutrient,
      proteins_100g: nutrient,
      carbohydrates_100g: nutrient,
      fat_100g: nutrient,
      fiber_100g: nutrient,
    })
    .optional(),
})

const offResponse = z.object({ products: z.array(offProduct) })

export type OffProduct = z.output<typeof offProduct>

export function mapOffProduct({
  code,
  product_name,
  brands,
  nutriments: n,
}: OffProduct): NutritionResult | null {
  const name = product_name?.trim()
  const kcal = n?.['energy-kcal_100g']
  if (!name || kcal == null) return null
  return {
    source: 'off',
    sourceId: code,
    name,
    brand: brands?.split(',')[0].trim() || null,
    per100g: {
      kcal,
      protein: n?.proteins_100g ?? 0,
      carbs: n?.carbohydrates_100g ?? 0,
      fat: n?.fat_100g ?? 0,
      fiber: n?.fiber_100g ?? null,
    },
  }
}

export async function searchOff(q: string, signal: AbortSignal) {
  const url = new URL('https://world.openfoodfacts.org/cgi/search.pl')
  url.search = new URLSearchParams({
    search_terms: q,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '10',
    fields: 'code,product_name,brands,nutriments',
  }).toString()
  const res = await fetch(url, { signal, headers: { 'User-Agent': OFF_USER_AGENT } })
  if (!res.ok) throw new Error(`Open Food Facts responded ${res.status}`)
  const { products } = offResponse.parse(await res.json())
  return products.map(mapOffProduct).filter((p) => p !== null)
}
