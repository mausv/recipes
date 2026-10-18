function servingsLabel(n: number) {
  return `${n} ${n === 1 ? 'serving' : 'servings'}`
}

export const pdf = {
  download: 'Download PDF',
  by: (name: string) => `by ${name}`,
  servingsScaled: (n: number) => `For ${servingsLabel(n)}`,
  servingsSplit: (n: number) => `The whole batch, divided into ${servingsLabel(n)}`,
  kcalTotal: (kcal: string) => `${kcal} kcal in total`,
  kcalBatch: (kcal: string) => `${kcal} kcal in the batch`,
  perServing: 'Per serving',
  figures: { kcal: 'kcal', protein: 'protein', carbs: 'carbs', fat: 'fat', fiber: 'fiber' },
  ingredients: 'Ingredients',
  steps: 'Steps',
  page: (n: number, total: number) => `Page ${n} of ${total}`,
}
