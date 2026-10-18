import { and, asc, between, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/db'
import { mealPlanEntry, recipe, user } from '@/db/schema'
import type { Locale } from '@/i18n'
import { intlLocale } from '@/i18n/format'
import { canViewRecipe, visibleRecipeFilter } from './access'
import { isMember } from './groups'
import { SLOTS, type Slot } from './validation/meal-plan'

const NOT_FOUND = 'Group not found'
const ENTRY_NOT_FOUND = 'Entry not found'

function toUtc(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

export function addDays(date: string, n: number) {
  const d = toUtc(date)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function mondayOf(date: string) {
  return addDays(date, -((toUtc(date).getUTCDay() + 6) % 7))
}

export function weekDays(monday: string) {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

export function addMonths(yyyyMm: string, n: number) {
  const [year, month] = yyyyMm.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1 + n, 1)).toISOString().slice(0, 7)
}

// Every day of the weeks that touch the month, Monday first.
export function monthDays(yyyyMm: string) {
  const start = mondayOf(`${yyyyMm}-01`)
  const end = addDays(mondayOf(addDays(`${addMonths(yyyyMm, 1)}-01`, -1)), 6)
  const days = [start]
  while (days[days.length - 1] !== end) days.push(addDays(days[days.length - 1], 1))
  return days
}

export function formatDay(
  date: string,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }
) {
  return new Intl.DateTimeFormat(intlLocale(locale), { ...options, timeZone: 'UTC' }).format(
    toUtc(date)
  )
}

export function isToday(date: string, today: string) {
  return date === today
}

export function localDate(now: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

type EntryBase = {
  id: string
  date: string
  slot: Slot
  position: number
  servings: number | null
  createdBy: string
}

export type PlanEntry = EntryBase &
  (
    | {
        kind: 'recipe'
        recipe: { id: string; title: string; coverImageId: string | null; servings: number }
      }
    | { kind: 'note'; note: string }
    | { kind: 'hidden' }
  )

function entriesBetween(groupId: string, userId: string, from: string, to: string) {
  const rows = db
    .select({
      id: mealPlanEntry.id,
      date: mealPlanEntry.date,
      slot: mealPlanEntry.slot,
      position: mealPlanEntry.position,
      servings: mealPlanEntry.servings,
      note: mealPlanEntry.note,
      createdBy: user.name,
      recipe: {
        id: recipe.id,
        title: recipe.title,
        coverImageId: recipe.coverImageId,
        servings: recipe.servings,
      },
    })
    .from(mealPlanEntry)
    .innerJoin(user, eq(user.id, mealPlanEntry.createdById))
    .leftJoin(recipe, eq(recipe.id, mealPlanEntry.recipeId))
    .where(and(eq(mealPlanEntry.groupId, groupId), between(mealPlanEntry.date, from, to)))
    .orderBy(asc(mealPlanEntry.date), asc(mealPlanEntry.position), asc(mealPlanEntry.createdAt))
    .all()

  const recipeIds = rows.flatMap((r) => (r.recipe ? [r.recipe.id] : []))
  const visible = new Set(
    db
      .select({ id: recipe.id })
      .from(recipe)
      .where(and(inArray(recipe.id, recipeIds), visibleRecipeFilter(userId)))
      .all()
      .map((r) => r.id)
  )

  return rows
    .map(({ note, recipe: found, ...base }): PlanEntry => {
      if (note !== null) return { ...base, kind: 'note', note }
      if (found && visible.has(found.id)) return { ...base, kind: 'recipe', recipe: found }
      return { ...base, kind: 'hidden' }
    })
    .sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot))
}

export function getWeek(groupId: string, userId: string, monday: string) {
  if (!isMember(userId, groupId)) return null
  const days = weekDays(monday)
  const entries = entriesBetween(groupId, userId, days[0], days[6])
  return days.map((date) => ({
    date,
    slots: SLOTS.map((slot) => ({
      slot,
      entries: entries.filter((e) => e.date === date && e.slot === slot),
    })),
  }))
}

function entryTitle(entry: PlanEntry) {
  if (entry.kind === 'recipe') return [entry.recipe.title]
  if (entry.kind === 'note') return [entry.note]
  return []
}

export function getMonth(groupId: string, userId: string, yyyyMm: string) {
  if (!isMember(userId, groupId)) return null
  const days = monthDays(yyyyMm)
  const entries = entriesBetween(groupId, userId, days[0], days[days.length - 1])
  return days.map((date) => {
    const onDay = entries.filter((e) => e.date === date)
    return { date, count: onDay.length, titles: onDay.flatMap(entryTitle).slice(0, 2) }
  })
}

function nextPosition(groupId: string, date: string, slot: Slot) {
  return db
    .select({ next: sql<number>`coalesce(max(${mealPlanEntry.position}), -1) + 1` })
    .from(mealPlanEntry)
    .where(
      and(
        eq(mealPlanEntry.groupId, groupId),
        eq(mealPlanEntry.date, date),
        eq(mealPlanEntry.slot, slot)
      )
    )
    .all()[0].next
}

function findEntry(groupId: string, id: string) {
  return db
    .select({ recipeId: mealPlanEntry.recipeId, note: mealPlanEntry.note })
    .from(mealPlanEntry)
    .where(and(eq(mealPlanEntry.id, id), eq(mealPlanEntry.groupId, groupId)))
    .get()
}

export function addEntry(
  groupId: string,
  userId: string,
  {
    date,
    slot,
    recipeId = null,
    servings = null,
    note = null,
  }: {
    date: string
    slot: Slot
    recipeId?: string | null
    servings?: number | null
    note?: string | null
  }
) {
  if (!isMember(userId, groupId)) return { error: NOT_FOUND }
  if ((recipeId === null) === (note === null)) return { error: 'Pick a recipe or write a note' }
  if (recipeId !== null && !canViewRecipe(userId, recipeId)) return { error: 'Recipe not found' }
  return db
    .insert(mealPlanEntry)
    .values({
      groupId,
      date,
      slot,
      recipeId,
      servings: recipeId === null ? null : servings,
      note,
      position: nextPosition(groupId, date, slot),
      createdById: userId,
    })
    .returning({ id: mealPlanEntry.id })
    .get()
}

export function updateEntry(
  groupId: string,
  userId: string,
  id: string,
  { servings, note }: { servings?: number | null; note?: string }
) {
  if (!isMember(userId, groupId)) return { error: NOT_FOUND }
  const entry = findEntry(groupId, id)
  if (!entry) return { error: ENTRY_NOT_FOUND }
  if (note !== undefined && entry.note === null) return { error: 'Only notes have text' }
  if (servings !== undefined && entry.note !== null) return { error: 'Notes have no servings' }
  db.update(mealPlanEntry).set({ servings, note }).where(eq(mealPlanEntry.id, id)).run()
  return {}
}

export function moveEntry(
  groupId: string,
  userId: string,
  id: string,
  { date, slot }: { date: string; slot: Slot }
) {
  if (!isMember(userId, groupId)) return { error: NOT_FOUND }
  if (!findEntry(groupId, id)) return { error: ENTRY_NOT_FOUND }
  db.update(mealPlanEntry)
    .set({ date, slot, position: nextPosition(groupId, date, slot) })
    .where(eq(mealPlanEntry.id, id))
    .run()
  return {}
}

export function removeEntry(groupId: string, userId: string, id: string) {
  if (!isMember(userId, groupId)) return { error: NOT_FOUND }
  const { changes } = db
    .delete(mealPlanEntry)
    .where(and(eq(mealPlanEntry.id, id), eq(mealPlanEntry.groupId, groupId)))
    .run()
  return changes ? {} : { error: ENTRY_NOT_FOUND }
}

export function clearDay(groupId: string, userId: string, date: string) {
  if (!isMember(userId, groupId)) return { error: NOT_FOUND }
  db.delete(mealPlanEntry)
    .where(and(eq(mealPlanEntry.groupId, groupId), eq(mealPlanEntry.date, date)))
    .run()
  return {}
}
