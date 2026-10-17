import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { buttonVariants } from '@/components/ui/button'
import { getActiveGroup } from '@/lib/active-group'
import {
  addDays,
  addMonths,
  formatDay,
  getMonth,
  getWeek,
  isToday,
  localDate,
  mondayOf,
} from '@/lib/meal-plan'
import { listRecipes } from '@/lib/recipes'
import { requireUser } from '@/lib/session'
import { dateSchema, monthSchema } from '@/lib/validation/meal-plan'
import { AddWeekButton } from './add-week-button'
import { MonthView } from './month-view'
import { WeekPlan } from './week-plan'

function PlanHeader({
  title,
  previous,
  next,
  today,
  toggle,
  children,
}: {
  title: string
  previous: { href: string; label: string }
  next: { href: string; label: string }
  today: string
  toggle: { href: string; label: string }
  children?: React.ReactNode
}) {
  const quiet = buttonVariants({ variant: 'ghost' })
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <h1 className="mr-auto text-[32px] leading-tight tracking-[-0.01em]">{title}</h1>
      <div className="flex flex-wrap items-center gap-1">
        <Link
          href={previous.href}
          aria-label={previous.label}
          className={buttonVariants({ variant: 'ghost', size: 'icon' })}
        >
          <ChevronLeft />
        </Link>
        <Link href={today} className={quiet}>
          Today
        </Link>
        <Link
          href={next.href}
          aria-label={next.label}
          className={buttonVariants({ variant: 'ghost', size: 'icon' })}
        >
          <ChevronRight />
        </Link>
        <Link href={toggle.href} className={quiet}>
          {toggle.label}
        </Link>
        {children}
      </div>
    </div>
  )
}

export default async function PlanPage({ searchParams }: PageProps<'/plan'>) {
  const { week, view, month } = await searchParams
  const user = await requireUser()
  const { id: groupId } = await getActiveGroup(user.id)
  const today = localDate(new Date())

  if (view === 'month') {
    const shown = monthSchema.safeParse(month).data ?? today.slice(0, 7)
    const days = getMonth(groupId, user.id, shown)
    if (!days) notFound()
    const monthHref = (m: string) => `/plan?view=month&month=${m}`
    return (
      <div className="space-y-6">
        <PlanHeader
          title={formatDay(`${shown}-01`, { month: 'long', year: 'numeric' })}
          previous={{ href: monthHref(addMonths(shown, -1)), label: 'Previous month' }}
          next={{ href: monthHref(addMonths(shown, 1)), label: 'Next month' }}
          today="/plan?view=month"
          toggle={{
            href: today.startsWith(shown) ? '/plan' : `/plan?week=${shown}-01`,
            label: 'Week',
          }}
        />
        <MonthView
          weekdays={days.slice(0, 7).map((d) => formatDay(d.date, { weekday: 'short' }))}
          days={days.map((d) => ({
            ...d,
            label: formatDay(d.date),
            dayNumber: formatDay(d.date, { day: 'numeric' }),
            inMonth: d.date.startsWith(shown),
            today: isToday(d.date, today),
          }))}
        />
      </div>
    )
  }

  const monday = mondayOf(dateSchema.safeParse(week).data ?? today)
  const days = getWeek(groupId, user.id, monday)
  if (!days) notFound()
  const recipes = listRecipes({ userId: user.id, groupId, scope: 'all' }).map((r) => ({
    id: r.id,
    title: r.title,
    servings: r.servings,
    coverImageId: r.coverImageId,
    kcalPerServing: r.kcalPerServing,
  }))
  const weekHref = (date: string) => `/plan?week=${date}`

  return (
    <div className="space-y-6">
      <PlanHeader
        title={`Week of ${formatDay(monday, { day: 'numeric', month: 'long' })}`}
        previous={{ href: weekHref(addDays(monday, -7)), label: 'Previous week' }}
        next={{ href: weekHref(addDays(monday, 7)), label: 'Next week' }}
        today="/plan"
        toggle={{ href: `/plan?view=month&month=${monday.slice(0, 7)}`, label: 'Month' }}
      >
        <AddWeekButton monday={monday} />
      </PlanHeader>
      <WeekPlan
        recipes={recipes}
        days={days.map((d) => ({
          ...d,
          label: formatDay(d.date),
          shortLabel: formatDay(d.date, { weekday: 'short', day: 'numeric' }),
          today: isToday(d.date, today),
        }))}
      />
    </div>
  )
}
