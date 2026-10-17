import { Plus, Search } from 'lucide-react'
import Form from 'next/form'
import Image from 'next/image'
import Link from 'next/link'
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
      <h1 className="sr-only">Recipes</h1>
      <div className="flex items-center gap-3">
        <Form action="/" className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Search recipes"
            aria-label="Search recipes"
            className="rounded-full pl-10"
          />
          {activeTag && <input type="hidden" name="tag" value={activeTag} />}
        </Form>
        <Link href="/recipes/new" className={buttonVariants()}>
          <Plus />
          New recipe
        </Link>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <Link
              key={t}
              href={href(query, t === activeTag ? '' : t)}
              aria-current={t === activeTag ? 'true' : undefined}
              className={cn(
                'relative flex h-9 items-center rounded-full border px-3.5 text-sm transition-colors after:absolute after:-inset-y-1',
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
        <div className="space-y-2 py-12">
          <p className="font-heading text-2xl font-medium">
            {filtered ? 'No recipes match.' : 'No recipes yet.'}
          </p>
          <p className="text-muted-foreground">
            {filtered ? (
              <Link href="/" className="text-primary underline underline-offset-4">
                Show all recipes
              </Link>
            ) : (
              <Link href="/recipes/new" className="text-primary underline underline-offset-4">
                Add the first one
              </Link>
            )}
            .
          </p>
        </div>
      ) : (
        <ul className="grid gap-x-6 gap-y-10 pt-2 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((r) => (
            <li key={r.id}>
              <Link href={`/recipes/${r.id}`} className="group block rounded-lg">
                <div className="relative flex aspect-4/3 items-center justify-center overflow-hidden rounded-lg bg-secondary">
                  {r.coverImageId ? (
                    <Image
                      src={`/api/images/${r.coverImageId}`}
                      alt=""
                      fill
                      unoptimized
                      sizes="(min-width: 1024px) 330px, (min-width: 640px) 50vw, 100vw"
                      className="object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="font-heading text-5xl font-medium text-primary uppercase"
                    >
                      {r.title.charAt(0)}
                    </span>
                  )}
                </div>
                <h2 className="mt-3 text-[22px] leading-tight decoration-1 underline-offset-4 group-hover:underline">
                  {r.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                  {r.servings} {r.servings === 1 ? 'serving' : 'servings'},{' '}
                  {formatKcal(r.kcalPerServing)} kcal each
                </p>
                {r.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {r.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-secondary px-2.5 py-1 text-[13px] leading-none text-secondary-foreground"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
