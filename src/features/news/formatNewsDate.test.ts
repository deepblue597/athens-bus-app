import { describe, expect, it } from 'vitest'
import { formatNewsDate } from './formatNewsDate'

// 21 Oct 2026, 15:06 in Athens (UTC+3)
const now = Date.UTC(2026, 9, 21, 12, 6)

describe('formatNewsDate', () => {
  it('says today or yesterday in Athens time', () => {
    expect(formatNewsDate(Date.UTC(2026, 9, 21, 6, 0), now)).toBe('Today, 09:00')
    // 22:30 UTC on the 20th is already the 21st in Athens
    expect(formatNewsDate(Date.UTC(2026, 9, 20, 22, 30), now)).toBe('Today, 01:30')
    expect(formatNewsDate(Date.UTC(2026, 9, 20, 6, 0), now)).toBe('Yesterday, 09:00')
  })

  it('gives the weekday and date this year, and the year before that', () => {
    expect(formatNewsDate(Date.UTC(2026, 9, 14, 4, 0), now)).toBe('Wed 14 Oct, 07:00')
    expect(formatNewsDate(Date.UTC(2025, 11, 30, 10, 0), now)).toBe('30 Dec 2025')
  })
})
