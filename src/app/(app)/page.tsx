import { Plus, Search } from 'lucide-react'
import Form from 'next/form'
import Image from 'next/image'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getActiveGroup } from '@/lib/active-group'
import { getT } from '@/lib/i18n-server'
import { formatKcal } from '@/lib/nutrition'
import { listRecipes, listTags, type RecipeScope } from '@/lib/recipes'
import { requireUser } from '@/lib/session'
import { cn } from '@/lib/utils'

function href(q: string, tag: string, scope: RecipeScope) {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (tag) params.set('tag', tag)
  if (scope !== 'all') params.set('scope', scope)
  const search = params.toString()
  return search ? `/?${search}` : '/'
}

function parseScope(value: string | string[] | undefined): RecipeScope {
  return value === 'mine' || value === 'group' ? value : 'all'
}

const linkClass = 'text-primary underline underline-offset-4'

export default async function RecipesPage({ searchParams }: PageProps<'/'>) {
  const { q, tag, scope: scopeParam } = await searchParams
  const query = typeof q === 'string' ? q.trim() : ''
  const activeTag = typeof tag === 'string' ? tag : ''
  const scope = parseScope(scopeParam)
  const user = await requireUser()
  const group = await getActiveGroup(user.id)
  const t = await getT()
  const recipes = listRecipes({
    userId: user.id,
    groupId: group.id,
    scope,
    q: query,
    tag: activeTag,
  })
  const tags = listTags({ userId: user.id, groupId: group.id, scope })
  const filtered = Boolean(query || activeTag)
  const scopes: { value: RecipeScope; label: string }[] = [
    { value: 'all', label: t.recipes.scopeAll },
    { value: 'mine', label: t.recipes.scopeMine },
    { value: 'group', label: t.recipes.scopeGroup(group.name) },
  ]

  return (
    <div className="space-y-6">
      <h1 className="sr-only">{t.recipes.title}</h1>
      <div className="flex items-center gap-3">
        <Form action="/" className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            type="search"
            defaultValue={query}
            placeholder={t.recipes.search}
            aria-label={t.recipes.search}
            className="rounded-full pl-10"
          />
          {activeTag && <input type="hidden" name="tag" value={activeTag} />}
          {scope !== 'all' && <input type="hidden" name="scope" value={scope} />}
        </Form>
        <Link href="/recipes/new" className={buttonVariants()}>
          <Plus />
          {t.recipes.newRecipe}
        </Link>
      </div>

      <nav
        aria-label={t.recipes.scopeLabel}
        className="flex max-w-full rounded-full bg-secondary p-1"
      >
        {scopes.map((s) => (
          <Link
            key={s.value}
            href={href(query, activeTag, s.value)}
            aria-current={s.value === scope ? 'page' : undefined}
            className={cn(
              'flex h-11 min-w-0 items-center rounded-full px-4 text-sm transition-colors sm:h-9',
              s.value === scope
                ? 'bg-background font-medium text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <span className="truncate">{s.label}</span>
          </Link>
        ))}
      </nav>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tagName) => (
            <Link
              key={tagName}
              href={href(query, tagName === activeTag ? '' : tagName, scope)}
              aria-current={tagName === activeTag ? 'true' : undefined}
              className={cn(
                'relative flex h-9 items-center rounded-full border px-3.5 text-sm transition-colors after:absolute after:-inset-y-1',
                tagName === activeTag
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tagName}
            </Link>
          ))}
        </div>
      )}

      {recipes.length === 0 ? (
        <div className="space-y-2 py-12">
          {filtered ? (
            <>
              <p className="font-heading text-2xl font-medium">{t.recipes.noMatch}</p>
              <p className="text-muted-foreground">
                <Link href={href('', '', scope)} className={linkClass}>
                  {t.recipes.clearSearch}
                </Link>
                .
              </p>
            </>
          ) : scope === 'group' ? (
            <>
              <p className="font-heading text-2xl font-medium">
                {t.recipes.nothingShared(group.name)}
              </p>
              <p className="text-muted-foreground">{t.recipes.shareFromPage}</p>
            </>
          ) : (
            <>
              <p className="font-heading text-2xl font-medium">
                {scope === 'mine' ? t.recipes.noneMine : t.recipes.none}
              </p>
              <p className="text-muted-foreground">
                <Link href="/recipes/new" className={linkClass}>
                  {t.recipes.addFirst}
                </Link>
                .
              </p>
            </>
          )}
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
                  {t.recipes.cardSummary(r.servings, formatKcal(r.kcalPerServing))}
                </p>
                {r.createdById !== user.id && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.recipes.sharedBy(r.ownerName)}
                  </p>
                )}
                {r.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {r.tags.map((tagName) => (
                      <span
                        key={tagName}
                        className="rounded-full bg-secondary px-2.5 py-1 text-[13px] leading-none text-secondary-foreground"
                      >
                        {tagName}
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
