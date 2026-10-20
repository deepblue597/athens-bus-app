import { describe, expect, it } from 'vitest'
import type { SavedQuery } from '../data/queryPersister'
import { isOutdatedQuery } from './queryClient'

const HOUR = 60 * 60_000
const evening = Date.parse('2026-10-20T20:30:00Z') // 23:30 in Athens

const saved = (queryKey: unknown[], dataUpdatedAt: number) => ({ queryKey, state: { dataUpdatedAt } }) as unknown as SavedQuery

describe('isOutdatedQuery', () => {
  it('drops the "Today" timetable once the day is over in Athens', () => {
    const today = saved(['timetable', '938', 'today'], evening)
    expect(isOutdatedQuery(today, evening + 15 * 60_000)).toBe(false)
    expect(isOutdatedQuery(today, evening + HOUR)).toBe(true)
  })

  it('also when the key carries the date', () => {
    expect(isOutdatedQuery(saved(['timetable', '938', 'today', '2026-10-20'], evening), evening + HOUR)).toBe(true)
  })

  it('keeps timetables for a schedule day, and other queries', () => {
    expect(isOutdatedQuery(saved(['timetable', '938', '54'], evening), evening + HOUR)).toBe(false)
    expect(isOutdatedQuery(saved(['lines'], evening), evening + HOUR)).toBe(false)
  })
})
