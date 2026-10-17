export type NutritionResult = {
  source: 'off' | 'usda'
  sourceId: string
  name: string
  brand: string | null
  per100g: { kcal: number; protein: number; carbs: number; fat: number; fiber: number | null }
}
