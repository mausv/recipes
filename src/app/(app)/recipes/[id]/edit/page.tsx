import { notFound } from 'next/navigation'
import { listIngredients } from '@/lib/ingredients'
import { getRecipeWithNutrition } from '@/lib/recipes'
import { RecipeForm } from '../../recipe-form'

export default async function EditRecipePage({ params }: PageProps<'/recipes/[id]/edit'>) {
  const { id } = await params
  const recipe = await getRecipeWithNutrition(id)
  if (!recipe) notFound()

  return (
    <RecipeForm
      library={listIngredients()}
      recipe={{
        id: recipe.id,
        title: recipe.title,
        description: recipe.description,
        servings: recipe.servings,
        cookedWeightGrams: recipe.cookedWeightGrams,
        tags: recipe.tags,
        coverImageId: recipe.coverImageId,
        ingredients: recipe.ingredients.map((l) => ({
          ingredientId: l.ingredientId,
          quantity: l.quantity,
          unit: l.unit,
          groupName: l.groupName,
        })),
        steps: recipe.steps.map((s) => ({ text: s.text, imageId: s.imageId })),
      }}
    />
  )
}
