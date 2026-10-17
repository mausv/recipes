import { Plus, Search } from 'lucide-react'
import Form from 'next/form'
import Link from 'next/link'
import { MacroSummary } from '@/components/macro-summary'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { listIngredients } from '@/lib/ingredients'
import { formatGrams, formatKcal } from '@/lib/nutrition'
import { SourceBadge } from './source-badge'

export default async function IngredientsPage({ searchParams }: PageProps<'/ingredients'>) {
  const { q } = await searchParams
  const query = typeof q === 'string' ? q.trim() : ''
  const ingredients = listIngredients(query)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Ingredients</h1>
        <Link href="/ingredients/new" className={buttonVariants()}>
          <Plus />
          New ingredient
        </Link>
      </div>

      <Form action="/ingredients" className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Search by name or brand"
          className="pl-8"
        />
      </Form>

      {ingredients.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          {query ? `No ingredients match “${query}”` : 'No ingredients yet'}
        </div>
      ) : (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">kcal</TableHead>
                  <TableHead className="text-right">Protein</TableHead>
                  <TableHead className="text-right">Carbs</TableHead>
                  <TableHead className="text-right">Fat</TableHead>
                  <TableHead className="text-right">Fiber</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ingredients.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>
                      <Link href={`/ingredients/${i.id}`} className="font-medium hover:underline">
                        {i.name}
                      </Link>
                      {i.brand && <div className="text-muted-foreground">{i.brand}</div>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatKcal(i.kcal)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatGrams(i.protein)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatGrams(i.carbs)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatGrams(i.fat)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {i.fiber === null ? '–' : formatGrams(i.fiber)}
                    </TableCell>
                    <TableCell>
                      <SourceBadge source={i.source} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mt-2 text-xs text-muted-foreground">Values per 100 g.</p>
          </div>

          <ul className="space-y-2 md:hidden">
            {ingredients.map((i) => (
              <li key={i.id}>
                <Link href={`/ingredients/${i.id}`}>
                  <Card size="sm">
                    <CardContent className="space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium">{i.name}</div>
                          {i.brand && <div className="text-muted-foreground">{i.brand}</div>}
                        </div>
                        <SourceBadge source={i.source} />
                      </div>
                      <MacroSummary macros={i} className="text-xs" />
                      <span className="text-xs text-muted-foreground"> per 100 g</span>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
