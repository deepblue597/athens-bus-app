import { describe, expect, it } from 'vitest'
import { greekPublicHolidays, isWeekendOrHoliday, orthodoxEaster } from './holidays'

describe('orthodoxEaster', () => {
  it('matches published dates', () => {
    expect(orthodoxEaster(2024)).toBe('2024-05-05')
    expect(orthodoxEaster(2025)).toBe('2025-04-20')
    expect(orthodoxEaster(2026)).toBe('2026-04-12')
    expect(orthodoxEaster(2027)).toBe('2027-05-02')
  })
})

describe('greekPublicHolidays', () => {
  it('has the fixed holidays and the ones that move with Easter', () => {
    expect(greekPublicHolidays(2026)).toEqual([
      '2026-01-01',
      '2026-01-06',
      '2026-02-23', // Clean Monday
      '2026-03-25',
      '2026-04-10', // Good Friday
      '2026-04-13', // Easter Monday
      '2026-05-01',
      '2026-06-01', // Whit Monday
      '2026-08-15',
      '2026-10-28',
      '2026-12-25',
      '2026-12-26',
    ])
  })
})

describe('isWeekendOrHoliday', () => {
  it('is true on Saturdays, Sundays and holidays', () => {
    expect(isWeekendOrHoliday('2026-10-27')).toBe(false) // Tuesday
    expect(isWeekendOrHoliday('2026-10-28')).toBe(true) // Ohi Day, a Wednesday
    expect(isWeekendOrHoliday('2026-10-31')).toBe(true) // Saturday
    expect(isWeekendOrHoliday('2026-11-01')).toBe(true) // Sunday
  })
})
