import { dictionaries, type Locale } from '@/i18n'
import { unitLabel } from '@/i18n/format'
import { formatGrams, formatKcal, type Macros, multiplyMacros } from '@/lib/nutrition'
import { formatQuantity } from '@/lib/units'

export type PdfMode = 'scale' | 'split'

type PdfImage = { id: string; width: number; height: number }

type PdfLine = {
  id: string
  quantity: number
  unit: string
  grams: number
  groupName: string | null
  ingredient: { name: string; brand: string | null }
}

export type PdfRecipe = {
  title: string
  description: string | null
  tags: string[]
  servings: number
  createdBy: { name: string }
  coverImage: PdfImage | null
  ingredients: PdfLine[]
  steps: { id: string; text: string; image: PdfImage | null }[]
  nutrition: { total: Macros }
}

const figureKeys = ['kcal', 'protein', 'carbs', 'fat', 'fiber'] as const

export function recipePdfModel(
  recipe: PdfRecipe,
  { servings, mode, locale }: { servings: number; mode: PdfMode; locale: Locale }
) {
  const t = dictionaries[locale].pdf
  const factor = mode === 'scale' ? servings / recipe.servings : 1
  const total = multiplyMacros(recipe.nutrition.total, factor)
  const perServing = multiplyMacros(total, 1 / servings)

  const groups = new Map<string | null, PdfLine[]>()
  for (const line of recipe.ingredients) {
    groups.set(line.groupName, [...(groups.get(line.groupName) ?? []), line])
  }

  return {
    locale,
    title: recipe.title,
    description: recipe.description,
    byline: t.by(recipe.createdBy.name),
    tags: recipe.tags,
    cover: recipe.coverImage,
    servings: mode === 'scale' ? t.servingsScaled(servings) : t.servingsSplit(servings),
    batchKcal:
      mode === 'scale' ? t.kcalTotal(formatKcal(total.kcal)) : t.kcalBatch(formatKcal(total.kcal)),
    perServingLabel: t.perServing,
    figures: figureKeys.map((key) => ({
      key,
      label: t.figures[key],
      value: key === 'kcal' ? formatKcal(perServing.kcal) : formatGrams(perServing[key]),
      unit: key === 'kcal' ? null : 'g',
    })),
    ingredientsLabel: t.ingredients,
    groups: [...groups].map(([name, lines]) => ({
      name,
      lines: lines.map((line) => ({
        id: line.id,
        amount: `${formatQuantity(line.quantity * factor)} ${unitLabel(line.unit, locale)}`,
        name: line.ingredient.name,
        brand: line.ingredient.brand,
        grams: line.unit === 'g' ? null : `${formatGrams(line.grams * factor)} g`,
      })),
    })),
    stepsLabel: t.steps,
    steps: recipe.steps.map((step, index) => ({
      id: step.id,
      number: index + 1,
      text: step.text,
      image: step.image,
    })),
    page: t.page,
  }
}

export type RecipePdfModel = ReturnType<typeof recipePdfModel>
