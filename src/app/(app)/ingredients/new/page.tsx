import { IngredientForm } from '../ingredient-form'

export default function NewIngredientPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">New ingredient</h1>
      <IngredientForm />
    </div>
  )
}
