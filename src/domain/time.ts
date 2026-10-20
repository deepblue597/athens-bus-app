import type { ScheduleTime } from './types'

/** Minutes since midnight in Athens, whatever the device's time zone */
export function athensMinutesNow(date: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Athens',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  return get('hour') * 60 + get('minute')
}

/** Today's date in Athens as YYYY-MM-DD, e.g. to key data that is only valid for one day */
export function athensDate(date: Date | number = new Date()): string {
  // en-CA formats dates as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

const DAY_MINUTES = 24 * 60

/**
 * Index of the next departure at or after `nowMinutes`, or -1 when the day's service is over.
 * Timetables run past midnight (minutesOfServiceDay > 1440), and the previous service day's late
 * trips can still be ahead: line 040 runs until 04:15, Χ95 and Χ14 until after 05:00, and night
 * lines such as 500 have only after-midnight trips. A late trip is taken when it comes before the
 * service day's own next departure. Today's timetable stands in for yesterday's, which is right
 * whenever both days have the same timetable type.
 */
export function nextDepartureIndex(times: ScheduleTime[], nowMinutes: number): number {
  const lateTrip = times.findIndex((t) => t.minutesOfServiceDay >= nowMinutes + DAY_MINUTES)
  const today = times.findIndex((t) => t.minutesOfServiceDay >= nowMinutes)
  if (lateTrip < 0) {
    return today
  }
  const lateWait = times[lateTrip].minutesOfServiceDay - DAY_MINUTES - nowMinutes
  return today < 0 || lateWait <= times[today].minutesOfServiceDay - nowMinutes ? lateTrip : today
}
