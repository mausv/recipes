import { io } from 'next/cache'
import { getT } from '@/lib/i18n-server'
import { listIngredientCategories } from '@/lib/ingredients'
import { IngredientForm } from '../ingredient-form'

export default async function NewIngredientPage() {
  await io()
  const t = await getT()
  return (
    <div className="max-w-2xl space-y-10">
      <h1 className="text-[32px] leading-tight tracking-[-0.01em]">
        {t.ingredients.newIngredient}
      </h1>
      <IngredientForm categories={listIngredientCategories()} />
    </div>
  )
}
