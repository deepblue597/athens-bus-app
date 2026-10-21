import { athensDate } from '../../domain/time'

const DAY_MS = 24 * 60 * 60_000

const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Athens', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const dayThisYear = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Athens', weekday: 'short', day: 'numeric', month: 'short' })
const dayOtherYear = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Athens', day: 'numeric', month: 'short', year: 'numeric' })

/** "Today, 15:06", "Yesterday, 09:00", "Tue 14 Oct, 07:00" or "14 Oct 2025", in Athens time */
export function formatNewsDate(epochMs: number, now: number = Date.now()): string {
  const day = athensDate(epochMs)
  if (day === athensDate(now)) {
    return `Today, ${time.format(epochMs)}`
  }
  if (day === athensDate(now - DAY_MS)) {
    return `Yesterday, ${time.format(epochMs)}`
  }
  if (day.slice(0, 4) === athensDate(now).slice(0, 4)) {
    return `${dayThisYear.format(epochMs).replace(',', '')}, ${time.format(epochMs)}`
  }
  return dayOtherYear.format(epochMs)
}
