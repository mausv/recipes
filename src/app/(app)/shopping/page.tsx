import { TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { listIngredients } from '@/lib/ingredients'
import { getShoppingList } from '@/lib/shopping-list'
import { AddItemForm } from './add-item-form'
import { PantryList } from './pantry-list'
import { ShoppingList } from './shopping-list'
import { ShoppingTabs } from './shopping-tabs'

export default async function ShoppingPage({ searchParams }: PageProps<'/shopping'>) {
  const { tab } = await searchParams

  const { needs, freeText, pantry } = getShoppingList()
  const library = listIngredients()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Shopping</h1>
      <ShoppingTabs defaultTab={tab === 'pantry' ? 'pantry' : 'list'}>
        <TabsList className="w-full sm:w-fit">
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="pantry">Pantry</TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="space-y-6 pt-4">
          <AddItemForm library={library} />
          <ShoppingList needs={needs} freeText={freeText} />
        </TabsContent>
        <TabsContent value="pantry" className="pt-4">
          <PantryList items={pantry} library={library} />
        </TabsContent>
      </ShoppingTabs>
    </div>
  )
}
