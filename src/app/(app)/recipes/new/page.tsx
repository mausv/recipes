import { io } from 'next/cache'
import { listIngredients } from '@/lib/ingredients'
import { RecipeForm } from '../recipe-form'

export default async function NewRecipePage() {
  await io()
  return <RecipeForm library={listIngredients()} />
}
