import { TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { listIngredients } from '@/lib/ingredients'
import { getShoppingList } from '@/lib/shopping-list'
import { AddItemForm } from './add-item-form'
import { PantryList } from './pantry-list'
import { ShoppingList } from './shopping-list'
import { ShoppingTabs } from './shopping-tabs'

const tabClass =
  'flex-none px-0 py-1 font-heading text-2xl font-medium after:bg-primary group-data-horizontal/tabs:after:-bottom-0.5'

export default async function ShoppingPage({ searchParams }: PageProps<'/shopping'>) {
  const { tab } = await searchParams

  const { needs, freeText, pantry } = getShoppingList()
  const library = listIngredients()

  return (
    <div className="max-w-2xl">
      <h1 className="sr-only">Shopping</h1>
      <ShoppingTabs defaultTab={tab === 'pantry' ? 'pantry' : 'list'}>
        <TabsList variant="line" className="gap-8 p-0 group-data-horizontal/tabs:h-auto">
          <TabsTrigger value="list" className={tabClass}>
            To buy
          </TabsTrigger>
          <TabsTrigger value="pantry" className={tabClass}>
            Pantry
          </TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="space-y-8 pt-6 text-base">
          <AddItemForm library={library} />
          <ShoppingList needs={needs} freeText={freeText} />
        </TabsContent>
        <TabsContent value="pantry" className="pt-6 text-base">
          <PantryList items={pantry} library={library} />
        </TabsContent>
      </ShoppingTabs>
    </div>
  )
}
