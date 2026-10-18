import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { setupTestDb } from '@/test/db'

const { db, schema, insertUser, insertGroup, insertRecipe, shareInto } = await setupTestDb()
const {
  addDays,
  addEntry,
  addMonths,
  clearDay,
  formatDay,
  getMonth,
  getWeek,
  isToday,
  localDate,
  mondayOf,
  monthDays,
  moveEntry,
  removeEntry,
  updateEntry,
  weekDays,
} = await import('./meal-plan')

const ana = insertUser()
const ben = insertUser()
const home = insertGroup('Home', [ana.id, ben.id])
const porridge = insertRecipe(ana.id, { title: 'Porridge', servings: 2 })
const MONDAY = '2026-10-12'
const WEDNESDAY = '2026-10-14'

beforeEach(() => {
  db.delete(schema.mealPlanEntry).run()
})

function added(result: { id: string } | { error: string }) {
  if ('error' in result) throw new Error(result.error)
  return result.id
}

function stored(id: string) {
  return db.select().from(schema.mealPlanEntry).where(eq(schema.mealPlanEntry.id, id)).get()
}

function dinner(date = WEDNESDAY) {
  return added(addEntry(home.id, ana.id, { date, slot: 'dinner', recipeId: porridge.id }))
}

describe('addDays', () => {
  it('moves forward within a month', () => {
    expect(addDays('2026-10-14', 3)).toBe('2026-10-17')
  })

  it('moves back across a month boundary', () => {
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30')
  })

  it('moves across a year boundary', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('lands on a leap day', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('skips the missing leap day in a common year', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
  })
})

describe('mondayOf', () => {
  it('returns the same date for a Monday', () => {
    expect(mondayOf(MONDAY)).toBe(MONDAY)
  })

  it('returns the previous Monday for a Sunday', () => {
    expect(mondayOf('2026-10-18')).toBe(MONDAY)
  })

  it('crosses back into the previous month', () => {
    expect(mondayOf('2026-10-01')).toBe('2026-09-28')
  })

  it('crosses back into the previous year', () => {
    expect(mondayOf('2027-01-01')).toBe('2026-12-28')
  })

  it('crosses back over a leap day', () => {
    expect(mondayOf('2028-03-01')).toBe('2028-02-28')
  })
})

describe('weekDays', () => {
  it('returns the seven days from Monday to Sunday', () => {
    expect(weekDays('2026-09-28')).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ])
  })
})

describe('addMonths', () => {
  it('moves to the next year after December', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01')
  })

  it('moves to the previous year before January', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12')
  })
})

describe('monthDays', () => {
  it('starts on the Monday on or before the first of the month', () => {
    expect(monthDays('2026-10')[0]).toBe('2026-09-28')
  })

  it('ends on the Sunday on or after the last of the month', () => {
    expect(monthDays('2026-10').at(-1)).toBe('2026-11-01')
  })

  it('returns whole weeks', () => {
    expect(monthDays('2026-10')).toHaveLength(35)
  })

  it('returns exactly four weeks for a February from Monday to Sunday', () => {
    expect(monthDays('2021-02')).toEqual(
      weekDays('2021-02-01').concat(
        weekDays('2021-02-08'),
        weekDays('2021-02-15'),
        weekDays('2021-02-22')
      )
    )
  })

  it('includes the leap day', () => {
    expect(monthDays('2028-02')).toContain('2028-02-29')
  })

  it('returns six weeks when the month spans them', () => {
    expect(monthDays('2026-08')).toHaveLength(42)
  })
})

describe('formatDay', () => {
  it('writes the weekday, day and month', () => {
    expect(formatDay(WEDNESDAY, 'en')).toBe('Wednesday, October 14')
  })

  it('writes Spanish weekday and month names', () => {
    expect(formatDay(WEDNESDAY, 'es')).toBe('miércoles, 14 de octubre')
    expect(formatDay(WEDNESDAY, 'es', { month: 'long', year: 'numeric' })).toBe('octubre de 2026')
  })

  it('accepts other format options', () => {
    expect(formatDay(WEDNESDAY, 'en', { day: 'numeric', month: 'long' })).toBe('October 14')
  })
})

describe('isToday', () => {
  it('is true for the same date', () => {
    expect(isToday(WEDNESDAY, WEDNESDAY)).toBe(true)
  })

  it('is false for another date', () => {
    expect(isToday(WEDNESDAY, '2026-10-15')).toBe(false)
  })
})

describe('localDate', () => {
  it('formats the local calendar date', () => {
    expect(localDate(new Date(2028, 1, 29, 23, 30))).toBe('2028-02-29')
  })
})

describe('getWeek', () => {
  it('returns seven days with the four slots in order', () => {
    const week = getWeek(home.id, ana.id, MONDAY)
    expect(week?.map((d) => d.date)).toEqual(weekDays(MONDAY))
    expect(week?.[0].slots.map((s) => s.slot)).toEqual(['breakfast', 'lunch', 'dinner', 'snack'])
  })

  it('returns a recipe entry with its recipe and creator', () => {
    const id = added(
      addEntry(home.id, ana.id, {
        date: WEDNESDAY,
        slot: 'dinner',
        recipeId: porridge.id,
        servings: 3,
      })
    )
    expect(getWeek(home.id, ana.id, MONDAY)?.[2].slots[2].entries).toEqual([
      {
        id,
        date: WEDNESDAY,
        slot: 'dinner',
        position: 0,
        servings: 3,
        createdBy: 'Ana',
        kind: 'recipe',
        recipe: { id: porridge.id, title: 'Porridge', coverImageId: null, servings: 2 },
      },
    ])
  })

  it('returns a note entry with its text', () => {
    addEntry(home.id, ana.id, { date: MONDAY, slot: 'lunch', note: 'Eat out' })
    expect(getWeek(home.id, ana.id, MONDAY)?.[0].slots[1].entries).toMatchObject([
      { kind: 'note', note: 'Eat out', servings: null },
    ])
  })

  it('orders entries in a slot by the order they were added', () => {
    addEntry(home.id, ana.id, { date: MONDAY, slot: 'lunch', note: 'First' })
    addEntry(home.id, ana.id, { date: MONDAY, slot: 'lunch', note: 'Second' })
    const entries = getWeek(home.id, ana.id, MONDAY)?.[0].slots[1].entries ?? []
    expect(entries.map((e) => (e.kind === 'note' ? e.note : null))).toEqual(['First', 'Second'])
  })

  it('leaves out entries outside the week', () => {
    dinner('2026-10-19')
    expect(
      getWeek(home.id, ana.id, MONDAY)?.flatMap((d) => d.slots.flatMap((s) => s.entries))
    ).toEqual([])
  })

  it('leaves out entries of another group', () => {
    const cabin = insertGroup('Cabin', [ana.id])
    addEntry(cabin.id, ana.id, { date: MONDAY, slot: 'lunch', note: 'Cabin lunch' })
    expect(getWeek(home.id, ana.id, MONDAY)?.[0].slots[1].entries).toEqual([])
  })

  it('hides the title of a recipe the user can no longer view', () => {
    const friendRecipe = insertRecipe(ben.id, { title: 'Secret stew' })
    shareInto(friendRecipe.id, home.id, ben.id)
    added(addEntry(home.id, ana.id, { date: MONDAY, slot: 'dinner', recipeId: friendRecipe.id }))
    db.delete(schema.recipeShare).where(eq(schema.recipeShare.recipeId, friendRecipe.id)).run()
    const [entry] = getWeek(home.id, ana.id, MONDAY)?.[0].slots[2].entries ?? []
    expect(entry).toMatchObject({ kind: 'hidden' })
    expect(entry).not.toHaveProperty('recipe')
  })

  it('shows the recipe to its owner after it was unshared', () => {
    const own = insertRecipe(ben.id, { title: 'Ben’s stew' })
    shareInto(own.id, home.id, ben.id)
    addEntry(home.id, ana.id, { date: MONDAY, slot: 'dinner', recipeId: own.id })
    db.delete(schema.recipeShare).where(eq(schema.recipeShare.recipeId, own.id)).run()
    expect(getWeek(home.id, ben.id, MONDAY)?.[0].slots[2].entries).toMatchObject([
      { kind: 'recipe', recipe: { title: 'Ben’s stew' } },
    ])
  })

  it('returns null for a non-member', () => {
    expect(getWeek(home.id, insertUser().id, MONDAY)).toBeNull()
  })
})

describe('getMonth', () => {
  it('returns a count per day of the grid', () => {
    dinner()
    addEntry(home.id, ana.id, { date: WEDNESDAY, slot: 'lunch', note: 'Soup' })
    const month = getMonth(home.id, ana.id, '2026-10')
    expect(month?.find((d) => d.date === WEDNESDAY)?.count).toBe(2)
    expect(month?.find((d) => d.date === MONDAY)?.count).toBe(0)
  })

  it('lists up to two titles in slot order', () => {
    dinner()
    addEntry(home.id, ana.id, { date: WEDNESDAY, slot: 'snack', note: 'Fruit' })
    addEntry(home.id, ana.id, { date: WEDNESDAY, slot: 'breakfast', note: 'Toast' })
    expect(getMonth(home.id, ana.id, '2026-10')?.find((d) => d.date === WEDNESDAY)).toEqual({
      date: WEDNESDAY,
      count: 3,
      titles: ['Toast', 'Porridge'],
    })
  })

  it('includes entries on the leading days of the next month', () => {
    dinner('2026-11-01')
    expect(getMonth(home.id, ana.id, '2026-10')?.at(-1)).toMatchObject({
      date: '2026-11-01',
      count: 1,
    })
  })

  it('counts a hidden recipe without its title', () => {
    const hidden = insertRecipe(ben.id, { title: 'Secret stew' })
    db.insert(schema.mealPlanEntry)
      .values({
        groupId: home.id,
        date: WEDNESDAY,
        slot: 'dinner',
        recipeId: hidden.id,
        position: 0,
        createdById: ben.id,
      })
      .run()
    expect(getMonth(home.id, ana.id, '2026-10')?.find((d) => d.date === WEDNESDAY)).toMatchObject({
      count: 1,
      titles: [],
    })
  })

  it('returns null for a non-member', () => {
    expect(getMonth(home.id, insertUser().id, '2026-10')).toBeNull()
  })
})

describe('addEntry', () => {
  it('stores a recipe entry with its servings', () => {
    const id = added(
      addEntry(home.id, ana.id, {
        date: WEDNESDAY,
        slot: 'dinner',
        recipeId: porridge.id,
        servings: 4,
      })
    )
    expect(stored(id)).toMatchObject({
      groupId: home.id,
      recipeId: porridge.id,
      servings: 4,
      note: null,
      createdById: ana.id,
    })
  })

  it('appends to the end of the slot', () => {
    dinner()
    expect(stored(dinner())?.position).toBe(1)
  })

  it('accepts a recipe shared into a group the user is in', () => {
    const shared = insertRecipe(ben.id)
    shareInto(shared.id, home.id, ben.id)
    expect(
      addEntry(home.id, ana.id, { date: MONDAY, slot: 'lunch', recipeId: shared.id })
    ).toHaveProperty('id')
  })

  it('refuses a recipe the user cannot view', () => {
    const hidden = insertRecipe(ben.id)
    expect(addEntry(home.id, ana.id, { date: MONDAY, slot: 'lunch', recipeId: hidden.id })).toEqual(
      { error: 'Recipe not found' }
    )
  })

  it('refuses an entry with both a recipe and a note', () => {
    expect(
      addEntry(home.id, ana.id, {
        date: MONDAY,
        slot: 'lunch',
        recipeId: porridge.id,
        note: 'Out',
      })
    ).toEqual({ error: 'Pick a recipe or write a note' })
  })

  it('refuses an entry with neither a recipe nor a note', () => {
    expect(addEntry(home.id, ana.id, { date: MONDAY, slot: 'lunch' })).toEqual({
      error: 'Pick a recipe or write a note',
    })
  })

  it('drops servings on a note', () => {
    const id = added(
      addEntry(home.id, ana.id, { date: MONDAY, slot: 'lunch', note: 'Out', servings: 2 })
    )
    expect(stored(id)?.servings).toBeNull()
  })

  it('refuses a non-member', () => {
    expect(
      addEntry(home.id, insertUser().id, { date: MONDAY, slot: 'lunch', note: 'Out' })
    ).toEqual({ error: 'Group not found' })
  })
})

describe('updateEntry', () => {
  it('changes the servings of a recipe entry', () => {
    const id = dinner()
    expect(updateEntry(home.id, ana.id, id, { servings: 5 })).toEqual({})
    expect(stored(id)?.servings).toBe(5)
  })

  it('resets the servings to the recipe default with null', () => {
    const id = added(
      addEntry(home.id, ana.id, {
        date: MONDAY,
        slot: 'dinner',
        recipeId: porridge.id,
        servings: 4,
      })
    )
    updateEntry(home.id, ana.id, id, { servings: null })
    expect(stored(id)?.servings).toBeNull()
  })

  it('changes the text of a note', () => {
    const id = added(addEntry(home.id, ana.id, { date: MONDAY, slot: 'lunch', note: 'Out' }))
    updateEntry(home.id, ben.id, id, { note: 'Leftovers' })
    expect(stored(id)?.note).toBe('Leftovers')
  })

  it('refuses text on a recipe entry', () => {
    expect(updateEntry(home.id, ana.id, dinner(), { note: 'x' })).toEqual({
      error: 'Only notes have text',
    })
  })

  it('refuses servings on a note', () => {
    const id = added(addEntry(home.id, ana.id, { date: MONDAY, slot: 'lunch', note: 'Out' }))
    expect(updateEntry(home.id, ana.id, id, { servings: 2 })).toEqual({
      error: 'Notes have no servings',
    })
  })

  it('refuses an entry of another group', () => {
    const cabin = insertGroup('Cabin', [ana.id])
    expect(updateEntry(cabin.id, ana.id, dinner(), { servings: 1 })).toEqual({
      error: 'Entry not found',
    })
  })

  it('refuses a non-member', () => {
    const id = dinner()
    expect(updateEntry(home.id, insertUser().id, id, { servings: 1 })).toEqual({
      error: 'Group not found',
    })
    expect(stored(id)?.servings).toBeNull()
  })
})

describe('moveEntry', () => {
  it('moves an entry to another day and slot', () => {
    const id = dinner()
    expect(moveEntry(home.id, ana.id, id, { date: '2026-10-20', slot: 'lunch' })).toEqual({})
    expect(stored(id)).toMatchObject({ date: '2026-10-20', slot: 'lunch' })
  })

  it('puts the moved entry at the end of the target slot', () => {
    const first = dinner(MONDAY)
    const moved = dinner()
    moveEntry(home.id, ana.id, moved, { date: MONDAY, slot: 'dinner' })
    expect([stored(first)?.position, stored(moved)?.position]).toEqual([0, 1])
  })

  it('refuses an entry of another group', () => {
    const cabin = insertGroup('Cabin', [ana.id])
    expect(moveEntry(cabin.id, ana.id, dinner(), { date: MONDAY, slot: 'lunch' })).toEqual({
      error: 'Entry not found',
    })
  })

  it('refuses a non-member', () => {
    const id = dinner()
    expect(moveEntry(home.id, insertUser().id, id, { date: MONDAY, slot: 'lunch' })).toEqual({
      error: 'Group not found',
    })
    expect(stored(id)?.date).toBe(WEDNESDAY)
  })
})

describe('removeEntry', () => {
  it('deletes the entry', () => {
    const id = dinner()
    expect(removeEntry(home.id, ben.id, id)).toEqual({})
    expect(stored(id)).toBeUndefined()
  })

  it('refuses a non-member', () => {
    const id = dinner()
    expect(removeEntry(home.id, insertUser().id, id)).toEqual({ error: 'Group not found' })
    expect(stored(id)).toBeDefined()
  })

  it('refuses an entry of another group', () => {
    const cabin = insertGroup('Cabin', [ana.id])
    const id = dinner()
    expect(removeEntry(cabin.id, ana.id, id)).toEqual({ error: 'Entry not found' })
    expect(stored(id)).toBeDefined()
  })
})

describe('clearDay', () => {
  it('removes every entry of the day', () => {
    dinner()
    addEntry(home.id, ana.id, { date: WEDNESDAY, slot: 'lunch', note: 'Soup' })
    clearDay(home.id, ana.id, WEDNESDAY)
    expect(getWeek(home.id, ana.id, MONDAY)?.[2].slots.flatMap((s) => s.entries)).toEqual([])
  })

  it('keeps other days', () => {
    const id = dinner(MONDAY)
    clearDay(home.id, ana.id, WEDNESDAY)
    expect(stored(id)).toBeDefined()
  })

  it('refuses a non-member', () => {
    const id = dinner()
    expect(clearDay(home.id, insertUser().id, WEDNESDAY)).toEqual({ error: 'Group not found' })
    expect(stored(id)).toBeDefined()
  })
})
