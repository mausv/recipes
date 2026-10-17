type BuiltInUnit = { name: string; label: string; kind: 'weight' | 'volume'; size: number }

// size is grams for weight units and millilitres for volume units
export const BUILT_IN_UNITS: readonly BuiltInUnit[] = [
  { name: 'g', label: 'g', kind: 'weight', size: 1 },
  { name: 'kg', label: 'kg', kind: 'weight', size: 1000 },
  { name: 'oz', label: 'oz', kind: 'weight', size: 28.3495 },
  { name: 'lb', label: 'lb', kind: 'weight', size: 453.592 },
  { name: 'ml', label: 'ml', kind: 'volume', size: 1 },
  { name: 'l', label: 'l', kind: 'volume', size: 1000 },
  { name: 'tsp', label: 'tsp', kind: 'volume', size: 5 },
  { name: 'tbsp', label: 'tbsp', kind: 'volume', size: 15 },
  { name: 'cup', label: 'cup', kind: 'volume', size: 240 },
  { name: 'fl oz', label: 'fl oz', kind: 'volume', size: 29.5735 },
]

export type CustomUnit = { name: string; grams: number }

function findCustom(unit: string, units: CustomUnit[]) {
  const key = unit.toLowerCase()
  return units.find((u) => u.name.toLowerCase() === key)
}

export function builtInUnitsFor(units: CustomUnit[]) {
  return BUILT_IN_UNITS.filter((u) => !findCustom(u.name, units))
}

export function isKnownUnit(unit: string, units: CustomUnit[]) {
  return BUILT_IN_UNITS.some((u) => u.name === unit) || findCustom(unit, units) !== undefined
}

export function toGrams(
  quantity: number,
  unit: string,
  { density, units }: { density: number; units: CustomUnit[] }
) {
  const custom = findCustom(unit, units)
  if (custom) return quantity * custom.grams
  const builtIn = BUILT_IN_UNITS.find((u) => u.name === unit)
  if (!builtIn) throw new Error(`Unknown unit: ${unit}`)
  return quantity * builtIn.size * (builtIn.kind === 'volume' ? density : 1)
}

export function formatQuantity(n: number) {
  return String(Number(n.toFixed(2)))
}
