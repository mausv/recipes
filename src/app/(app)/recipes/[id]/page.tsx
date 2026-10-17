import { and, asc, eq } from 'drizzle-orm'
import { Download, Pencil } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { deleteRecipe } from '@/actions/recipes'
import { AddToShoppingListButton } from '@/components/add-to-shopping-list'
import { ConfirmDeleteButton } from '@/components/confirm-delete-button'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { db } from '@/db'
import { recipeComment, recipeNote } from '@/db/schema'
import { getRecipeWithNutrition } from '@/lib/recipes'
import { requireUser } from '@/lib/session'
import { CommentForm } from './comment-form'
import { DeleteCommentButton } from './delete-comment-button'
import { NoteForm } from './note-form'
import { RecipeBody } from './recipe-body'

const commentDate = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' })

export default async function RecipePage({ params }: PageProps<'/recipes/[id]'>) {
  const { id } = await params
  const recipe = await getRecipeWithNutrition(id)
  if (!recipe) notFound()
  const user = await requireUser()
  const comments = await db.query.recipeComment.findMany({
    where: eq(recipeComment.recipeId, id),
    orderBy: asc(recipeComment.createdAt),
    with: { user: { columns: { name: true } } },
  })
  const note = db
    .select({ text: recipeNote.text })
    .from(recipeNote)
    .where(and(eq(recipeNote.recipeId, id), eq(recipeNote.userId, user.id)))
    .get()

  return (
    <article className="space-y-8">
      {recipe.coverImage && (
        <Image
          src={`/api/images/${recipe.coverImage.id}`}
          alt=""
          width={recipe.coverImage.width}
          height={recipe.coverImage.height}
          unoptimized
          preload
          className="max-h-[28rem] w-full rounded-xl object-cover"
        />
      )}

      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="text-3xl font-semibold">{recipe.title}</h1>
          <div className="flex flex-wrap gap-2">
            <Link href={`/recipes/${id}/edit`} className={buttonVariants({ variant: 'outline' })}>
              <Pencil />
              Edit
            </Link>
            <a
              href={`/api/export?recipe=${id}&images=1`}
              className={buttonVariants({ variant: 'outline' })}
            >
              <Download />
              Export
            </a>
            <AddToShoppingListButton recipeId={id} defaultServings={recipe.servings} />

            <ConfirmDeleteButton
              title={`Delete ${recipe.title}?`}
              description="This permanently deletes the recipe and its photos."
              onConfirmAction={deleteRecipe.bind(null, id)}
              redirectTo="/"
            />
          </div>
        </div>
        {recipe.description && (
          <p className="whitespace-pre-line text-muted-foreground">{recipe.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>By {recipe.createdBy.name}</span>
          {recipe.tags.map((tag) => (
            <Link key={tag} href={`/?tag=${encodeURIComponent(tag)}`}>
              <Badge variant="secondary">{tag}</Badge>
            </Link>
          ))}
        </div>
      </header>

      <RecipeBody
        baseServings={recipe.servings}
        lines={recipe.ingredients}
        nutrition={recipe.nutrition}
        steps={
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Steps</h2>
            {recipe.steps.length === 0 && <p className="text-muted-foreground">No steps yet.</p>}
            <ol className="space-y-6">
              {recipe.steps.map((step, index) => (
                <li key={step.id} className="flex gap-4">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1 space-y-3">
                    <p className="whitespace-pre-line">{step.text}</p>
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
      />

      <Card>
        <CardHeader>
          <CardTitle>Your notes</CardTitle>
          <CardDescription>Private to you.</CardDescription>
        </CardHeader>
        <CardContent>
          <NoteForm recipeId={id} text={note?.text ?? ''} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {comments.length === 0 ? (
            <p className="text-muted-foreground">No comments yet.</p>
          ) : (
            <ul className="space-y-4">
              {comments.map((comment) => (
                <li key={comment.id} className="flex items-start gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">{comment.user.name}</span>
                      {' · '}
                      <time dateTime={comment.createdAt.toISOString()}>
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
        </CardContent>
      </Card>
    </article>
  )
}
