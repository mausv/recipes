import { Plus, Search } from 'lucide-react'
import Form from 'next/form'
import Link from 'next/link'
import { MacroSummary } from '@/components/macro-summary'
import { buttonVariants } from '@/components/ui/button'
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
        <h1 className="text-[32px] leading-tight tracking-[-0.01em]">Ingredients</h1>
        <Link href="/ingredients/new" className={buttonVariants()}>
          <Plus />
          New ingredient
        </Link>
      </div>

      <Form action="/ingredients" className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Search by name or brand"
          aria-label="Search ingredients"
          className="rounded-full pl-10"
        />
      </Form>

      {ingredients.length === 0 ? (
        <div className="space-y-2 py-12">
          <p className="font-heading text-2xl font-medium">
            {query ? `No ingredients match “${query}”.` : 'No ingredients yet.'}
          </p>
          <p className="text-muted-foreground">
            {query ? (
              <Link href="/ingredients" className="text-primary underline underline-offset-4">
                Show all ingredients
              </Link>
            ) : (
              <Link href="/ingredients/new" className="text-primary underline underline-offset-4">
                Add the first one
              </Link>
            )}
            .
          </p>
        </div>
      ) : (
        <>
          <div className="hidden md:block">
            <Table className="text-[15px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-0 font-normal text-muted-foreground">Name</TableHead>
                  <TableHead className="text-right font-normal text-muted-foreground">
                    kcal
                  </TableHead>
                  <TableHead className="text-right font-normal text-muted-foreground">
                    Protein
                  </TableHead>
                  <TableHead className="text-right font-normal text-muted-foreground">
                    Carbs
                  </TableHead>
                  <TableHead className="text-right font-normal text-muted-foreground">
                    Fat
                  </TableHead>
                  <TableHead className="text-right font-normal text-muted-foreground">
                    Fiber
                  </TableHead>
                  <TableHead className="font-normal text-muted-foreground">Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ingredients.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="py-3 pl-0">
                      <Link
                        href={`/ingredients/${i.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {i.name}
                      </Link>
                      {i.brand && (
                        <div className="text-[13px] text-muted-foreground">{i.brand}</div>
                      )}
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
            <p className="mt-3 text-[13px] text-muted-foreground">Values per 100 g.</p>
          </div>

          <ul className="divide-y md:hidden">
            {ingredients.map((i) => (
              <li key={i.id}>
                <Link
                  href={`/ingredients/${i.id}`}
                  className="flex items-start justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-[17px] leading-snug">{i.name}</p>
                    {i.brand && <p className="text-[13px] text-muted-foreground">{i.brand}</p>}
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      <MacroSummary macros={i} /> per 100 g
                    </p>
                  </div>
                  <SourceBadge source={i.source} />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
