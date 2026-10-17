export type Macros = { kcal: number; protein: number; carbs: number; fat: number; fiber: number }

const ZERO: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }

export function multiplyMacros(m: Macros, factor: number): Macros {
  return {
    kcal: m.kcal * factor,
    protein: m.protein * factor,
    carbs: m.carbs * factor,
    fat: m.fat * factor,
    fiber: m.fiber * factor,
  }
}

export function scaleMacros(per100g: Macros, grams: number) {
  return multiplyMacros(per100g, grams / 100)
}

export function sumMacros(list: Macros[]) {
  return list.reduce<Macros>(
    (sum, m) => ({
      kcal: sum.kcal + m.kcal,
      protein: sum.protein + m.protein,
      carbs: sum.carbs + m.carbs,
      fat: sum.fat + m.fat,
      fiber: sum.fiber + m.fiber,
    }),
    ZERO
  )
}

export function computeRecipeNutrition({
  ingredients,
  servings,
  cookedWeightGrams,
}: {
  ingredients: { grams: number; per100g: Macros }[]
  servings: number
  cookedWeightGrams?: number | null
}) {
  const total = sumMacros(ingredients.map((i) => scaleMacros(i.per100g, i.grams)))
  const totalGrams = ingredients.reduce((sum, i) => sum + i.grams, 0)
  const weight = cookedWeightGrams ?? totalGrams
  return {
    total,
    perServing: multiplyMacros(total, 1 / servings),
    per100g: weight > 0 ? multiplyMacros(total, 100 / weight) : ZERO,
    totalGrams,
  }
}

export type MacroSource = {
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber: number | null
}

export function toMacros({ kcal, protein, carbs, fat, fiber }: MacroSource): Macros {
  return { kcal, protein, carbs, fat, fiber: fiber ?? 0 }
}

export function computeRecipeBreakdown({
  lines,
  servings,
  cookedWeightGrams,
}: {
  lines: { grams: number; ingredient: MacroSource }[]
  servings: number
  cookedWeightGrams?: number | null
}) {
  const ingredients = lines.map((l) => ({ grams: l.grams, per100g: toMacros(l.ingredient) }))
  return {
    ...computeRecipeNutrition({ ingredients, servings, cookedWeightGrams }),
    contributions: ingredients.map((i) => scaleMacros(i.per100g, i.grams)),
  }
}

export function formatKcal(kcal: number) {
  return String(Math.round(kcal))
}

export function formatGrams(grams: number) {
  return String(Number(grams.toFixed(1)))
}
