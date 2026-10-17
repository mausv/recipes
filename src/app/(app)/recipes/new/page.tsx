import { io } from 'next/cache'
import { listIngredients } from '@/lib/ingredients'
import { RecipeForm } from '../recipe-form'

export default async function NewRecipePage() {
  await io()
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">New recipe</h1>
      <RecipeForm library={listIngredients()} />
    </div>
  )
}
