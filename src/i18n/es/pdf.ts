import type { pdf as en } from '../en/pdf'

function servingsLabel(n: number) {
  return `${n} ${n === 1 ? 'porción' : 'porciones'}`
}

export const pdf: typeof en = {
  download: 'Descargar PDF',
  by: (name) => `por ${name}`,
  servingsScaled: (n) => `Para ${servingsLabel(n)}`,
  servingsSplit: (n) => `La tanda completa, dividida en ${servingsLabel(n)}`,
  kcalTotal: (kcal) => `${kcal} kcal en total`,
  kcalBatch: (kcal) => `${kcal} kcal en la tanda`,
  perServing: 'Por porción',
  figures: {
    kcal: 'kcal',
    protein: 'proteína',
    carbs: 'carbohidratos',
    fat: 'grasa',
    fiber: 'fibra',
  },
  ingredients: 'Ingredientes',
  steps: 'Pasos',
  page: (n, total) => `Página ${n} de ${total}`,
}
