import { notFound } from 'next/navigation'
import { deleteIngredient } from '@/actions/ingredients'
import { ConfirmDeleteButton } from '@/components/confirm-delete-button'
import { getT } from '@/lib/i18n-server'
import { getIngredient, listIngredientCategories } from '@/lib/ingredients'
import { IngredientForm } from '../ingredient-form'

export default async function EditIngredientPage({ params }: PageProps<'/ingredients/[id]'>) {
  const { id } = await params
  const ingredient = getIngredient(id)
  if (!ingredient) notFound()
  const t = await getT()

  return (
    <div className="max-w-2xl space-y-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[32px] leading-tight tracking-[-0.01em]">
          {t.ingredients.editIngredient}
        </h1>
        <ConfirmDeleteButton
          title={t.ingredients.deleteTitle(ingredient.name)}
          description={t.ingredients.deleteDescription}
          onConfirmAction={deleteIngredient.bind(null, id)}
          redirectTo="/ingredients"
        />
      </div>
      <IngredientForm ingredient={ingredient} categories={listIngredientCategories()} />
    </div>
  )
}
