export const BASE_UNITS = ['g', 'kg', 'ml', 'l'] as const

export type CustomUnit = { name: string; grams: number }

export function toGrams(
  quantity: number,
  unit: string,
  { density, units }: { density: number; units: CustomUnit[] }
) {
  switch (unit) {
    case 'g':
      return quantity
    case 'kg':
      return quantity * 1000
    case 'ml':
      return quantity * density
    case 'l':
      return quantity * 1000 * density
  }
  const custom = units.find((u) => u.name === unit)
  if (!custom) throw new Error(`Unknown unit: ${unit}`)
  return quantity * custom.grams
}

export function formatQuantity(n: number) {
  return String(Number(n.toFixed(2)))
}
