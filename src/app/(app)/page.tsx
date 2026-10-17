import { Plus, Search, UtensilsCrossed } from 'lucide-react'
import Form from 'next/form'
import Image from 'next/image'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatKcal } from '@/lib/nutrition'
import { listRecipes, listTags } from '@/lib/recipes'
import { cn } from '@/lib/utils'

function href(q: string, tag: string) {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (tag) params.set('tag', tag)
  const search = params.toString()
  return search ? `/?${search}` : '/'
}

export default async function RecipesPage({ searchParams }: PageProps<'/'>) {
  const { q, tag } = await searchParams
  const query = typeof q === 'string' ? q.trim() : ''
  const activeTag = typeof tag === 'string' ? tag : ''
  const recipes = listRecipes({ q: query, tag: activeTag })
  const tags = listTags()
  const filtered = Boolean(query || activeTag)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Recipes</h1>
        <Link href="/recipes/new" className={buttonVariants()}>
          <Plus />
          New recipe
        </Link>
      </div>

      <Form action="/" className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Search titles and tags"
          className="pl-8"
        />
        {activeTag && <input type="hidden" name="tag" value={activeTag} />}
      </Form>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <Link
              key={t}
              href={href(query, t === activeTag ? '' : t)}
              className={cn(
                'rounded-full border px-3 py-1 text-sm transition-colors',
                t === activeTag
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t}
            </Link>
          ))}
        </div>
      )}

      {recipes.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          {filtered ? 'No recipes match' : 'No recipes yet'}
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((r) => (
            <li key={r.id}>
              <Link
                href={`/recipes/${r.id}`}
                className="group block overflow-hidden rounded-xl ring-1 ring-foreground/10"
              >
                <div className="relative flex aspect-4/3 items-center justify-center bg-muted">
                  {r.coverImageId ? (
                    <Image
                      src={`/api/images/${r.coverImageId}`}
                      alt=""
                      fill
                      unoptimized
                      className="object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <UtensilsCrossed className="size-8 text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-2 p-3">
                  <h2 className="font-medium">{r.title}</h2>
                  <p className="text-sm text-muted-foreground tabular-nums">
                    {r.servings} {r.servings === 1 ? 'serving' : 'servings'} ·{' '}
                    {formatKcal(r.kcalPerServing)} kcal/serving
                  </p>
                  {r.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {r.tags.map((t) => (
                        <Badge key={t} variant="secondary">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
