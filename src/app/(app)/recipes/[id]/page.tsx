import { Download, Pencil } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { deleteRecipe } from '@/actions/recipes'
import { AddToShoppingListButton } from '@/components/add-to-shopping-list'
import { ConfirmDeleteButton } from '@/components/confirm-delete-button'
import { buttonVariants } from '@/components/ui/button'
import { listComments } from '@/lib/comments'
import { listGroups } from '@/lib/groups'
import { getNote } from '@/lib/notes'
import { getRecipeWithNutrition, listRecipeShares } from '@/lib/recipes'
import { requireUser } from '@/lib/session'
import { CommentForm } from './comment-form'
import { CopyButton } from './copy-button'
import { DeleteCommentButton } from './delete-comment-button'
import { NoteForm } from './note-form'
import { RecipeBody } from './recipe-body'
import { ShareButton } from './share-button'

const commentDate = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' })

export default async function RecipePage({ params }: PageProps<'/recipes/[id]'>) {
  const { id } = await params
  const user = await requireUser()
  const recipe = await getRecipeWithNutrition(id, user.id)
  if (!recipe) notFound()
  const isOwner = recipe.createdById === user.id
  const comments = listComments(user.id, id)
  const note = getNote(user.id, id)
  const sharedIds = new Set(listRecipeShares(id).map((s) => s.groupId))
  const shareGroups = isOwner
    ? listGroups(user.id).map((g) => ({ id: g.id, name: g.name, shared: sharedIds.has(g.id) }))
    : []

  return (
    <article>
      {recipe.coverImage && (
        <Image
          src={`/api/images/${recipe.coverImage.id}`}
          alt=""
          width={recipe.coverImage.width}
          height={recipe.coverImage.height}
          unoptimized
          preload
          className="-mx-4 -mt-6 aspect-4/3 w-[calc(100%+2rem)] max-w-none bg-secondary object-cover md:mx-0 md:mt-0 md:aspect-auto md:max-h-[480px] md:w-full md:rounded-lg"
        />
      )}

      <header className="mt-6 grid gap-y-3 md:mt-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-x-10">
        <h1 className="text-[40px] leading-[1.05] tracking-[-0.02em] text-balance md:text-[56px] lg:col-start-1">
          {recipe.title}
        </h1>
        {recipe.description && (
          <p className="max-w-[60ch] text-[17px] whitespace-pre-line text-muted-foreground lg:col-start-1">
            {recipe.description}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground lg:col-start-1">
          <span className="mr-1">by {recipe.createdBy.name}</span>
          {recipe.tags.map((tag) => (
            <Link
              key={tag}
              href={`/?tag=${encodeURIComponent(tag)}`}
              className="relative rounded-full bg-secondary px-2.5 py-1.5 leading-none text-secondary-foreground after:absolute after:-inset-y-2.5 hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_6%)]"
            >
              {tag}
            </Link>
          ))}
        </div>
        <div className="order-last flex flex-wrap items-center gap-x-1 gap-y-2 pt-2 lg:order-none lg:col-start-2 lg:row-start-1 lg:self-end lg:pt-0">
          <AddToShoppingListButton recipeId={id} defaultServings={recipe.servings} />
          {isOwner ? (
            <>
              <ShareButton recipeId={id} groups={shareGroups} />
              <Link href={`/recipes/${id}/edit`} className={buttonVariants({ variant: 'ghost' })}>
                <Pencil />
                Edit
              </Link>
              <a
                href={`/api/export?recipe=${id}&images=1`}
                className={buttonVariants({ variant: 'ghost' })}
              >
                <Download />
                Export
              </a>
              <ConfirmDeleteButton
                title={`Delete ${recipe.title}?`}
                description="This permanently deletes the recipe and its photos."
                onConfirmAction={deleteRecipe.bind(null, id)}
                redirectTo="/"
              />
            </>
          ) : (
            <CopyButton recipeId={id} />
          )}
        </div>
      </header>

      <RecipeBody
        baseServings={recipe.servings}
        lines={recipe.ingredients}
        nutrition={recipe.nutrition}
        steps={
          <section className="space-y-6">
            <h2 className="text-2xl">Steps</h2>
            {recipe.steps.length === 0 && <p className="text-muted-foreground">No steps yet.</p>}
            <ol className="space-y-7">
              {recipe.steps.map((step, index) => (
                <li key={step.id} className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-baseline">
                  <span className="font-heading text-[28px] leading-none font-medium text-primary tabular-nums">
                    {index + 1}
                  </span>
                  <div className="space-y-4">
                    <p className="text-[17px] leading-[1.65] whitespace-pre-line">{step.text}</p>
                    {step.image && (
                      <Image
                        src={`/api/images/${step.image.id}`}
                        alt={`Step ${index + 1}`}
                        width={step.image.width}
                        height={step.image.height}
                        unoptimized
                        className="h-auto w-full max-w-md rounded-lg"
                      />
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        }
      >
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl">Your notes</h2>
            <p className="text-sm text-muted-foreground">Private to you.</p>
          </div>
          <NoteForm recipeId={id} text={note?.text ?? ''} />
        </section>

        <section className="space-y-5">
          <h2 className="text-2xl">Comments</h2>
          {comments.length === 0 ? (
            <p className="text-muted-foreground">No comments yet.</p>
          ) : (
            <ul className="divide-y">
              {comments.map((comment) => (
                <li key={comment.id} className="flex items-start gap-2 py-4 first:pt-0">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-medium">{comment.user.name}</span>
                      <time
                        dateTime={comment.createdAt.toISOString()}
                        className="text-[13px] text-muted-foreground"
                      >
                        {commentDate.format(comment.createdAt)}
                      </time>
                    </p>
                    <p className="whitespace-pre-line">{comment.text}</p>
                  </div>
                  {comment.userId === user.id && <DeleteCommentButton id={comment.id} />}
                </li>
              ))}
            </ul>
          )}
          <CommentForm recipeId={id} />
        </section>
      </RecipeBody>
    </article>
  )
}
