import { searchOff } from './off'
import type { NutritionResult } from './types'
import { searchUsda } from './usda'

export type { NutritionResult } from './types'

const TIMEOUT_MS = 6000

export async function searchNutrition(q: string) {
  const apiKey = process.env.USDA_API_KEY
  const sources: ((signal: AbortSignal) => Promise<NutritionResult[]>)[] = [
    (signal) => searchOff(q, signal),
  ]
  if (apiKey) sources.push((signal) => searchUsda(q, apiKey, signal))

  const settled = await Promise.allSettled(
    sources.map((search) => search(AbortSignal.timeout(TIMEOUT_MS)))
  )
  return settled.flatMap((result) => {
    if (result.status === 'fulfilled') return result.value
    console.error('Nutrition source failed:', result.reason)
    return []
  })
}
