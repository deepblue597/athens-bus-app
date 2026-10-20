import type { ScheduleTime } from './types'

export interface Line {
  /** OASA LineCode, unique; used in API calls and URLs */
  code: string
  /** Line number shown on the bus, e.g. "040" or "Β1". Not unique: variants share it */
  id: string
  /** Master line code, needed for timetables */
  masterCode: string
  name: string
  nameEn: string | null
  /** A part-route version of a line that shares its number, e.g. Α7 "(ΑΠΟ ΣΤΑΣΗ 1η ΚΡΥΟΝΕΡΙΟΥ)" */
  isVariant: boolean
}

/** One direction of a line: its main route plus any alternative routes (detours, night variants) */
export interface LineDirection {
  /** OASA RouteType: "1" outbound, "2" return */
  type: string
  routeCode: string
  name: string
  nameEn: string | null
  /** Where the route starts, taken from its name ("ΠΕΙΡΑΙΑΣ - ΣΥΝΤΑΓΜΑ" → "ΠΕΙΡΑΙΑΣ") */
  from: string
  variants: { routeCode: string; name: string }[]
}

/** A timetable type such as weekday, Saturday or Sunday */
export interface ScheduleDay {
  code: string
  name: string
  nameEn: string | null
  /** Short English label: "Weekdays", "Saturday", "Weekend", "Every day", "Mon–Thu"… */
  label: string
}

export interface Timetable {
  /** Departures on the RouteType "1" route, in service-day order */
  outbound: ScheduleTime[]
  /** Departures on the RouteType "2" route (empty for circular lines) */
  inbound: ScheduleTime[]
}

/** One direction tab of a line's timetable */
export interface TimetableSide {
  /** The route the departures run on; undefined while routes load or when OASA has none */
  direction: LineDirection | undefined
  times: ScheduleTime[]
}

/**
 * Pairs a timetable with the line's directions: outbound runs on the RouteType "1" route, inbound
 * on "2". A line with both directions always gets both sides, so the tabs don't change between
 * days. Otherwise only sides with departures are kept, because single-route lines don't follow the
 * pattern: circular lines and some part-route variants have one RouteType "1" route but list their
 * trips as inbound (Α7 "ΑΠΟ ΣΤΑΣΗ 1η ΚΡΥΟΝΕΡΙΟΥ"), and others have only a RouteType "2" route
 * (Α1 "ΑΠΟ ΕΚΚΛΗΣΙΑ ΒΑΡΗΣ ΕΩΣ ΠΕΙΡΑΙΑ").
 */
export function timetableSides(directions: LineDirection[], timetable: Timetable): TimetableSide[] {
  const outbound = directions.find((d) => d.type === '1')
  const inbound = directions.find((d) => d.type === '2')
  const sides: TimetableSide[] = [
    { direction: outbound, times: timetable.outbound },
    { direction: inbound, times: timetable.inbound },
  ]
  if (outbound && inbound) {
    return sides
  }
  const withTimes = sides.filter((s) => s.times.length > 0)
  if (withTimes.length === 2) {
    return sides
  }
  const only = directions.length === 1 ? directions[0] : (outbound ?? inbound)
  return [{ direction: only, times: withTimes[0]?.times ?? [] }]
}
