import Link from 'next/link'
import { cn } from '@/lib/utils'

export type MonthDay = {
  date: string
  label: string
  dayNumber: string
  inMonth: boolean
  today: boolean
  count: number
  titles: string[]
}

function weekHref(date: string) {
  return `/plan?week=${date}`
}

export function MonthView({ days, weekdays }: { days: MonthDay[]; weekdays: string[] }) {
  return (
    <>
      <ul className="divide-y border-y lg:hidden">
        {days
          .filter((d) => d.inMonth)
          .map((day) => (
            <li key={day.date}>
              <Link
                href={weekHref(day.date)}
                className="flex min-h-12 items-center justify-between gap-3 py-2"
              >
                <span className="flex items-center gap-2">
                  {day.label}
                  {day.today && (
                    <>
                      <span aria-hidden className="size-2 rounded-full bg-primary" />
                      <span className="sr-only">(today)</span>
                    </>
                  )}
                </span>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {day.count > 0 && `${day.count} planned`}
                </span>
              </Link>
            </li>
          ))}
      </ul>

      <div className="hidden lg:block">
        <div className="grid grid-cols-7 pb-2 text-sm text-muted-foreground">
          {weekdays.map((name) => (
            <span key={name} className="px-2">
              {name}
            </span>
          ))}
        </div>
        <ol className="grid grid-cols-7 border-t border-l">
          {days.map((day) => (
            <li key={day.date} className="min-w-0 border-r border-b">
              <Link
                href={weekHref(day.date)}
                className={cn(
                  'flex h-full min-h-28 flex-col gap-1 p-2 transition-colors hover:bg-secondary',
                  !day.inMonth && 'text-muted-foreground'
                )}
              >
                <span
                  className={cn(
                    'flex size-7 items-center justify-center rounded-full font-heading text-base tabular-nums',
                    day.today && 'bg-primary text-primary-foreground'
                  )}
                >
                  <span className="sr-only">
                    {day.label}
                    {day.today && ' (today)'}
                  </span>
                  <span aria-hidden>{day.dayNumber}</span>
                </span>
                {day.titles.map((title, i) => (
                  <span key={i} className="truncate text-[13px] leading-snug">
                    {title}
                  </span>
                ))}
                {day.count > day.titles.length && (
                  <span className="text-[13px] text-muted-foreground">
                    +{day.count - day.titles.length} more
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </>
  )
}
