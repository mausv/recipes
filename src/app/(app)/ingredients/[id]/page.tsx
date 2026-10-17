import { notFound } from 'next/navigation'
import { deleteIngredient } from '@/actions/ingredients'
import { ConfirmDeleteButton } from '@/components/confirm-delete-button'
import { getIngredient } from '@/lib/ingredients'
import { IngredientForm } from '../ingredient-form'

export default async function EditIngredientPage({ params }: PageProps<'/ingredients/[id]'>) {
  const { id } = await params
  const ingredient = getIngredient(id)
  if (!ingredient) notFound()

  return (
    <div className="max-w-2xl space-y-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[32px] leading-tight tracking-[-0.01em]">Edit ingredient</h1>
        <ConfirmDeleteButton
          title={`Delete ${ingredient.name}?`}
          description="This removes it from the ingredient library. Ingredients used by a recipe can't be deleted."
          onConfirmAction={deleteIngredient.bind(null, id)}
          redirectTo="/ingredients"
        />
      </div>
      <IngredientForm ingredient={ingredient} />
    </div>
  )
}
