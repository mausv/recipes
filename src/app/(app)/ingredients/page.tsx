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
import { getT } from '@/lib/i18n-server'
import { groupByCategory, listIngredients } from '@/lib/ingredients'
import { formatGrams, formatKcal } from '@/lib/nutrition'
import { SourceBadge } from './source-badge'

export default async function IngredientsPage({ searchParams }: PageProps<'/ingredients'>) {
  const { q } = await searchParams
  const query = typeof q === 'string' ? q.trim() : ''
  const ingredients = listIngredients(query)
  const groups = groupByCategory(ingredients)
  const showHeadings = groups.some(([category]) => category !== null)
  const t = await getT()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[32px] leading-tight tracking-[-0.01em]">{t.ingredients.title}</h1>
        <Link href="/ingredients/new" className={buttonVariants()}>
          <Plus />
          {t.ingredients.newIngredient}
        </Link>
      </div>

      <Form action="/ingredients" className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="q"
          type="search"
          defaultValue={query}
          placeholder={t.ingredients.searchPlaceholder}
          aria-label={t.ingredients.searchLabel}
          className="rounded-full pl-10"
        />
      </Form>

      {ingredients.length === 0 ? (
        <div className="space-y-2 py-12">
          <p className="font-heading text-2xl font-medium">
            {query ? t.ingredients.noMatch(query) : t.ingredients.empty}
          </p>
          <p className="text-muted-foreground">
            {query ? (
              <Link href="/ingredients" className="text-primary underline underline-offset-4">
                {t.ingredients.showAll}
              </Link>
            ) : (
              <Link href="/ingredients/new" className="text-primary underline underline-offset-4">
                {t.ingredients.addFirst}
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
                  <TableHead className="pl-0 font-normal text-muted-foreground">
                    {t.ingredients.name}
                  </TableHead>
                  <TableHead className="text-right font-normal text-muted-foreground">
                    kcal
                  </TableHead>
                  <TableHead className="text-right font-normal text-muted-foreground">
                    {t.ingredients.protein}
                  </TableHead>
                  <TableHead className="text-right font-normal text-muted-foreground">
                    {t.ingredients.carbs}
                  </TableHead>
                  <TableHead className="text-right font-normal text-muted-foreground">
                    {t.ingredients.fat}
                  </TableHead>
                  <TableHead className="text-right font-normal text-muted-foreground">
                    {t.ingredients.fiber}
                  </TableHead>
                  <TableHead className="font-normal text-muted-foreground">
                    {t.ingredients.source}
                  </TableHead>
                </TableRow>
              </TableHeader>
              {groups.map(([category, items]) => (
                <TableBody key={category ?? ''}>
                  {showHeadings && (
                    <TableRow className="border-b-0 hover:bg-transparent">
                      <TableHead
                        colSpan={7}
                        scope="colgroup"
                        className="h-auto pt-6 pb-1 pl-0 font-heading text-[19px] font-normal italic"
                      >
                        {category ?? t.ingredients.other}
                      </TableHead>
                    </TableRow>
                  )}
                  {items.map((i) => (
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
                      <TableCell className="text-right tabular-nums">
                        {formatKcal(i.kcal)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatGrams(i.protein)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatGrams(i.carbs)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatGrams(i.fat)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {i.fiber === null ? '–' : formatGrams(i.fiber)}
                      </TableCell>
                      <TableCell>
                        <SourceBadge source={i.source} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              ))}
            </Table>
            <p className="mt-3 text-[13px] text-muted-foreground">{t.ingredients.valuesPer100g}</p>
          </div>

          <div className="md:hidden">
            {groups.map(([category, items]) => (
              <section key={category ?? ''}>
                {showHeadings && (
                  <h2 className="pt-4 pb-1 text-[19px] font-normal italic">
                    {category ?? t.ingredients.other}
                  </h2>
                )}
                <ul className="divide-y">
                  {items.map((i) => (
                    <li key={i.id}>
                      <Link
                        href={`/ingredients/${i.id}`}
                        className="flex items-start justify-between gap-3 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-[17px] leading-snug">{i.name}</p>
                          {i.brand && (
                            <p className="text-[13px] text-muted-foreground">{i.brand}</p>
                          )}
                          <p className="mt-1 text-[13px] text-muted-foreground">
                            <MacroSummary macros={i} /> {t.ingredients.per100g}
                          </p>
                        </div>
                        <SourceBadge source={i.source} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
