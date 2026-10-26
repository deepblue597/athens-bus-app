// Greek public holidays, when the Proastiakos runs its weekend timetable ("Σάββατο, Κυριακή &
// αργίες"). Shared with scripts/build-metro.ts, so no imports here.

/** Orthodox Easter Sunday of a year (1900–2099) as YYYY-MM-DD: the Julian date by Meeus's method, plus 13 days */
export function orthodoxEaster(year: number): string {
  const a = year % 4
  const b = year % 7
  const c = year % 19
  const d = (19 * c + 15) % 30
  const e = (2 * a + 4 * b - d + 34) % 7
  const month = Math.floor((d + e + 114) / 31)
  const day = ((d + e + 114) % 31) + 1
  return isoDate(Date.UTC(year, month - 1, day + 13))
}

/**
 * The year's national public holidays: the fixed ones, and Clean Monday, Good Friday, Easter Monday
 * and Whit Monday, which move with Easter. Holy Saturday and Easter Sunday are weekend days anyway.
 */
export function greekPublicHolidays(year: number): string[] {
  const easter = Date.parse(`${orthodoxEaster(year)}T00:00:00Z`)
  const fromEaster = (days: number) => isoDate(easter + days * 86_400_000)
  const fixed = ['01-01', '01-06', '03-25', '05-01', '08-15', '10-28', '12-25', '12-26'].map((d) => `${year}-${d}`)
  return [...fixed, fromEaster(-48), fromEaster(-2), fromEaster(1), fromEaster(50)].sort()
}

/** Saturdays, Sundays and public holidays: the days the Proastiakos runs its weekend timetable */
export function isWeekendOrHoliday(date: string): boolean {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay()
  return weekday === 0 || weekday === 6 || greekPublicHolidays(Number(date.slice(0, 4))).includes(date)
}

function isoDate(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10)
}
