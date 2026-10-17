import { z } from 'zod'
import type { NutritionResult } from './types'

const usdaFood = z.object({
  fdcId: z.number(),
  description: z.string(),
  brandName: z.string().optional(),
  brandOwner: z.string().optional(),
  foodNutrients: z.array(
    z.object({ nutrientNumber: z.string().optional(), value: z.number().optional() })
  ),
})

const usdaResponse = z.object({ foods: z.array(usdaFood) })

export type UsdaFood = z.output<typeof usdaFood>

export function mapUsdaFood({
  fdcId,
  description,
  brandName,
  brandOwner,
  foodNutrients,
}: UsdaFood): NutritionResult | null {
  const nutrient = (number: string) =>
    foodNutrients.find((n) => n.nutrientNumber === number)?.value ?? null
  const kcal = nutrient('208')
  const name = description.trim()
  if (!name || kcal === null) return null
  return {
    source: 'usda',
    sourceId: String(fdcId),
    name,
    brand: brandName || brandOwner || null,
    per100g: {
      kcal,
      protein: nutrient('203') ?? 0,
      carbs: nutrient('205') ?? 0,
      fat: nutrient('204') ?? 0,
      fiber: nutrient('291'),
    },
  }
}

export async function searchUsda(q: string, apiKey: string, signal: AbortSignal) {
  const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search')
  url.search = new URLSearchParams({
    api_key: apiKey,
    query: q,
    pageSize: '10',
    dataType: 'Foundation,SR Legacy,Branded',
  }).toString()
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`USDA responded ${res.status}`)
  const { foods } = usdaResponse.parse(await res.json())
  return foods.map(mapUsdaFood).filter((f) => f !== null)
}
