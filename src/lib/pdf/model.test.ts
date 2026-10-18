import { describe, expect, it } from 'vitest'
import { type PdfRecipe, recipePdfModel } from './model'

function line(
  id: string,
  quantity: number,
  unit: string,
  grams: number,
  groupName: string | null = null,
  brand: string | null = null
) {
  return { id, quantity, unit, grams, groupName, ingredient: { name: id, brand } }
}

const recipe: PdfRecipe = {
  title: 'Porridge',
  description: 'Creamy oats',
  tags: ['breakfast', 'quick'],
  servings: 2,
  createdBy: { name: 'Ana' },
  coverImage: { id: 'cover', width: 1600, height: 1200 },
  ingredients: [
    line('oats', 80, 'g', 80),
    line('milk', 1.5, 'cup', 360, null, 'Lala'),
    line('honey', 1, 'tbsp', 21, 'Topping'),
    line('cinnamon', 0.5, 'tsp', 1.3, 'Topping'),
    line('salt', 1, 'pinch', 0.4),
  ],
  steps: [
    { id: 's1', text: 'Simmer the oats.', image: null },
    { id: 's2', text: 'Top and serve.', image: { id: 'step', width: 800, height: 600 } },
  ],
  nutrition: { total: { kcal: 800, protein: 30, carbs: 120, fat: 20, fiber: 10 } },
}

function figures(model: ReturnType<typeof recipePdfModel>) {
  return Object.fromEntries(model.figures.map((f) => [f.key, f.value]))
}

describe('recipePdfModel', () => {
  it('keeps the recipe as written at its own servings', () => {
    const model = recipePdfModel(recipe, { servings: 2, mode: 'scale', locale: 'en' })
    expect(model.groups[0].lines.map((l) => l.amount)).toEqual(['80 g', '1.5 cup', '1 pinch'])
    expect(figures(model)).toEqual({
      kcal: '400',
      protein: '15',
      carbs: '60',
      fat: '10',
      fiber: '5',
    })
    expect(model.servings).toBe('For 2 servings')
    expect(model.batchKcal).toBe('800 kcal in total')
  })

  it('scales quantities, grams and the batch but keeps per-serving macros in scale mode', () => {
    const model = recipePdfModel(recipe, { servings: 3, mode: 'scale', locale: 'en' })
    expect(model.groups[0].lines.map((l) => [l.amount, l.grams])).toEqual([
      ['120 g', null],
      ['2.25 cup', '540 g'],
      ['1.5 pinch', '0.6 g'],
    ])
    expect(figures(model)).toEqual({
      kcal: '400',
      protein: '15',
      carbs: '60',
      fat: '10',
      fiber: '5',
    })
    expect(model.batchKcal).toBe('1200 kcal in total')
  })

  it('keeps quantities and divides the batch per serving in split mode', () => {
    const model = recipePdfModel(recipe, { servings: 3, mode: 'split', locale: 'en' })
    expect(model.groups[0].lines.map((l) => [l.amount, l.grams])).toEqual([
      ['80 g', null],
      ['1.5 cup', '360 g'],
      ['1 pinch', '0.4 g'],
    ])
    expect(figures(model)).toEqual({
      kcal: '267',
      protein: '10',
      carbs: '40',
      fat: '6.7',
      fiber: '3.3',
    })
    expect(model.servings).toBe('The whole batch, divided into 3 servings')
    expect(model.batchKcal).toBe('800 kcal in the batch')
  })

  it('groups lines by group name in first-appearance order', () => {
    const model = recipePdfModel(recipe, { servings: 2, mode: 'scale', locale: 'en' })
    expect(model.groups.map((g) => [g.name, g.lines.map((l) => l.name)])).toEqual([
      [null, ['oats', 'milk', 'salt']],
      ['Topping', ['honey', 'cinnamon']],
    ])
  })

  it('shows grams only for lines not already measured in grams', () => {
    const model = recipePdfModel(recipe, { servings: 2, mode: 'scale', locale: 'en' })
    expect(model.groups[1].lines.map((l) => l.grams)).toEqual(['21 g', '1.3 g'])
    expect(model.groups[0].lines[0].grams).toBeNull()
  })

  it('carries brands, steps, images and recipe details through', () => {
    const model = recipePdfModel(recipe, { servings: 2, mode: 'scale', locale: 'en' })
    expect(model.groups[0].lines[1].brand).toBe('Lala')
    expect(model.steps).toEqual([
      { id: 's1', number: 1, text: 'Simmer the oats.', image: null },
      { id: 's2', number: 2, text: 'Top and serve.', image: recipe.steps[1].image },
    ])
    expect(model.cover).toBe(recipe.coverImage)
    expect(model.title).toBe('Porridge')
    expect(model.description).toBe('Creamy oats')
    expect(model.tags).toEqual(['breakfast', 'quick'])
    expect(model.byline).toBe('by Ana')
  })

  it('labels everything in English', () => {
    const model = recipePdfModel(recipe, { servings: 1, mode: 'scale', locale: 'en' })
    expect(model.servings).toBe('For 1 serving')
    expect(model.perServingLabel).toBe('Per serving')
    expect(model.ingredientsLabel).toBe('Ingredients')
    expect(model.stepsLabel).toBe('Steps')
    expect(model.figures.map((f) => [f.label, f.unit])).toEqual([
      ['kcal', null],
      ['protein', 'g'],
      ['carbs', 'g'],
      ['fat', 'g'],
      ['fiber', 'g'],
    ])
    expect(model.page(2, 3)).toBe('Page 2 of 3')
  })

  it('labels everything in Spanish, including unit labels and plurals', () => {
    const scaled = recipePdfModel(recipe, { servings: 1, mode: 'scale', locale: 'es' })
    expect(scaled.groups.flatMap((g) => g.lines.map((l) => l.amount))).toEqual([
      '40 g',
      '0.75 taza',
      '0.5 pinch',
      '0.5 cda',
      '0.25 cdta',
    ])
    expect(scaled.servings).toBe('Para 1 porción')
    expect(scaled.batchKcal).toBe('400 kcal en total')
    expect(scaled.byline).toBe('por Ana')
    expect(scaled.perServingLabel).toBe('Por porción')
    expect(scaled.ingredientsLabel).toBe('Ingredientes')
    expect(scaled.stepsLabel).toBe('Pasos')
    expect(scaled.figures.map((f) => f.label)).toEqual([
      'kcal',
      'proteína',
      'carbohidratos',
      'grasa',
      'fibra',
    ])
    expect(scaled.page(1, 2)).toBe('Página 1 de 2')

    const split = recipePdfModel(recipe, { servings: 4, mode: 'split', locale: 'es' })
    expect(split.servings).toBe('La tanda completa, dividida en 4 porciones')
    expect(split.batchKcal).toBe('800 kcal en la tanda')
  })

  it('handles a recipe with no ingredients or steps', () => {
    const model = recipePdfModel(
      {
        ...recipe,
        ingredients: [],
        steps: [],
        nutrition: { total: { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 } },
      },
      { servings: 2, mode: 'scale', locale: 'en' }
    )
    expect(model.groups).toEqual([])
    expect(model.steps).toEqual([])
    expect(figures(model).kcal).toBe('0')
  })
})
