import { describe, expect, it } from 'vitest'
import { athensDate, athensMinutesNow, nextDepartureIndex } from './time'
import type { ScheduleTime } from './types'

const t = (label: string, minutesOfServiceDay: number): ScheduleTime => ({ label, minutesOfServiceDay })
const times = [t('05:00', 300), t('12:00', 720), t('23:30', 1410), t('00:30', 1470)]

describe('athensMinutesNow', () => {
  it('uses Athens time (UTC+3 in summer)', () => {
    expect(athensMinutesNow(new Date('2026-07-01T09:15:00Z'))).toBe(12 * 60 + 15)
  })

  it('uses Athens time (UTC+2 in winter)', () => {
    expect(athensMinutesNow(new Date('2026-12-01T09:15:00Z'))).toBe(11 * 60 + 15)
  })
})

describe('athensDate', () => {
  it('changes at midnight in Athens, not UTC', () => {
    expect(athensDate(new Date('2026-10-20T20:59:00Z'))).toBe('2026-10-20')
    expect(athensDate(new Date('2026-10-20T21:00:00Z'))).toBe('2026-10-21')
    expect(athensDate(Date.UTC(2026, 11, 31, 22, 0))).toBe('2027-01-01')
  })
})

describe('nextDepartureIndex', () => {
  it('finds the next departure during the day', () => {
    expect(nextDepartureIndex(times, 11 * 60)).toBe(1)
  })

  it('counts a departure at the current minute as next', () => {
    expect(nextDepartureIndex(times, 720)).toBe(1)
  })

  it('finds the previous service day’s after-midnight trip early in the morning', () => {
    expect(nextDepartureIndex(times, 15)).toBe(3)
  })

  it('falls back to the morning departures once the late trips are over', () => {
    expect(nextDepartureIndex(times, 2 * 60)).toBe(0)
  })

  it('takes yesterday’s late trip after 04:00 when it leaves before today’s first one', () => {
    // Line 040, getSchedLines weekday: outbound runs 04:30 … 03:30, 04:00 (1900-01-02)
    const line040 = [t('04:30', 270), t('04:45', 285), t('03:30', 1650), t('04:00', 1680)]
    expect(nextDepartureIndex(line040, 4 * 60)).toBe(3)
    expect(nextDepartureIndex(line040, 4 * 60 + 1)).toBe(0)
  })

  it('finds a night line’s last trips in the early morning', () => {
    // Night line 500 (877), inbound weekday: every trip is after midnight, the last at 04:45
    const line500 = [t('00:50', 1490), t('01:50', 1550), t('02:50', 1610), t('03:50', 1670), t('04:45', 1725)]
    expect(nextDepartureIndex(line500, 4 * 60 + 30)).toBe(4)
    // …and tonight’s first trip once they are over
    expect(nextDepartureIndex(line500, 5 * 60)).toBe(0)
    expect(nextDepartureIndex(line500, 22 * 60)).toBe(0)
  })

  it('returns -1 after the last departure', () => {
    expect(nextDepartureIndex([t('05:00', 300), t('12:00', 720)], 23 * 60)).toBe(-1)
  })
})
