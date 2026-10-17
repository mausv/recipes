import { IngredientForm } from '../ingredient-form'

export default function NewIngredientPage() {
  return (
    <div className="max-w-2xl space-y-10">
      <h1 className="text-[32px] leading-tight tracking-[-0.01em]">New ingredient</h1>
      <IngredientForm />
    </div>
  )
}
