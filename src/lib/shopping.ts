export type ShoppingLine = {
  ingredientId: string | null
  name: string
  grams: number | null
  quantity: number | null
  unit: string | null
  recipeId: string | null
}

export type Need<T extends ShoppingLine> = {
  ingredientId: string
  name: string
  grams: number | null
  quantity: number | null
  unit: string | null
  recipeIds: string[]
  lines: T[]
}

function sumOrNull(values: (number | null)[]) {
  let total = 0
  for (const value of values) {
    if (value === null) return null
    total += value
  }
  return total
}

export function mergeNeeds<T extends ShoppingLine>(lines: T[]) {
  const groups = new Map<string, T[]>()
  const freeText: T[] = []
  for (const line of lines) {
    if (line.ingredientId === null) freeText.push(line)
    else groups.set(line.ingredientId, [...(groups.get(line.ingredientId) ?? []), line])
  }

  const needs = [...groups].map(([ingredientId, group]): Need<T> => {
    const unit = group[0].unit
    const sameUnit = unit !== null && group.every((l) => l.unit === unit)
    return {
      ingredientId,
      name: group[0].name,
      grams: sumOrNull(group.map((l) => l.grams)),
      quantity: sameUnit ? sumOrNull(group.map((l) => l.quantity)) : null,
      unit: sameUnit ? unit : null,
      recipeIds: [...new Set(group.flatMap((l) => (l.recipeId === null ? [] : [l.recipeId])))],
      lines: group,
    }
  })
  return { needs, freeText }
}

function remainingQuantity(
  quantity: number | null,
  neededGrams: number | null,
  toBuyGrams: number | null
) {
  if (quantity === null || toBuyGrams === null) return quantity
  return neededGrams ? (quantity * toBuyGrams) / neededGrams : 0
}

export function applyPantry<T extends ShoppingLine>(
  needs: Need<T>[],
  pantry: { ingredientId: string; grams: number | null }[]
) {
  const stock = new Map(pantry.map((p) => [p.ingredientId, p.grams]))
  return needs.map((need) => {
    const inPantry = stock.has(need.ingredientId)
    const haveGrams = inPantry ? (stock.get(need.ingredientId) ?? null) : 0
    const toBuyGrams =
      haveGrams === null ? 0 : need.grams === null ? null : Math.max(0, need.grams - haveGrams)
    return {
      ...need,
      neededGrams: need.grams,
      haveGrams,
      toBuyGrams,
      toBuyQuantity: remainingQuantity(need.quantity, need.grams, toBuyGrams),
      covered: inPantry && toBuyGrams === 0,
    }
  })
}

export function scaleIngredientLines<T extends { quantity: number; grams: number }>(
  lines: T[],
  fromServings: number,
  toServings: number
) {
  const factor = toServings / fromServings
  return lines.map((line) => ({
    ...line,
    quantity: line.quantity * factor,
    grams: line.grams * factor,
  }))
}
