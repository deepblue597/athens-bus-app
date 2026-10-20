import type { ILineWithMLInfo, IRoute, IScheduleDay } from 'oasa-telematics-api'
import type { Line, LineDirection, ScheduleDay, Timetable } from '../../domain/line'
import type { ScheduleTime } from '../../domain/types'
import { asList, OasaApiError, parseScheduleTime } from './adapters'

export function toLines(raw: ILineWithMLInfo[] | null): Line[] {
  return asList(raw).map((l) => ({
    code: l.line_code,
    id: l.line_id,
    masterCode: l.ml_code,
    name: l.line_descr,
    nameEn: l.line_descr_eng || null,
    // Part-route versions of a line ("(ΑΠΟ ΣΤΑΣΗ 1η ΚΡΥΟΝΕΡΙΟΥ)") have mld_master "0"
    isVariant: l.mld_master === '0',
  }))
}

/**
 * Groups a line's routes by direction. Alternative routes carry bracketed notes
 * ("ΠΕΙΡΑΙΑΣ - ΣΥΝΤΑΓΜΑ [22:00-06:00]"), but so do some main routes ("ΠΕΙΡΑΙΑΣ - ΚΗΦΙΣΙΑ [ΝΥΧΤΕΡΙΝΗ]"
 * next to "... [ΝΥΧΤΕΡΙΝΗ] [ΣΑΒΒΑΤΟ-ΚΥΡΙΑΚΗ]"), so the main route is the one with the fewest notes.
 */
export function toLineDirections(raw: IRoute[] | null): LineDirection[] {
  const byType = new Map<string, IRoute[]>()
  for (const r of asList(raw)) {
    if (!r.RouteType) {
      continue
    }
    byType.set(r.RouteType, [...(byType.get(r.RouteType) ?? []), r])
  }
  return [...byType.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([type, routes]) => {
      const main = routes.reduce((best, r) => (noteCount(r.RouteDescr) < noteCount(best.RouteDescr) ? r : best))
      return {
        type,
        routeCode: main.RouteCode,
        name: main.RouteDescr,
        nameEn: main.RouteDescrEng || null,
        from: startingPoint(main.RouteDescr),
        variants: routes.filter((r) => r !== main).map((r) => ({ routeCode: r.RouteCode, name: r.RouteDescr })),
      }
    })
}

const noteCount = (name: string) => name.split('[').length - 1

/**
 * Where a route starts, from its name:
 * "ΠΕΙΡΑΙΑΣ - ΣΥΝΤΑΓΜΑ" → "ΠΕΙΡΑΙΑΣ", "ΠΕΡΙΣΤΕΡΙ [ΑΓ. ΙΕΡΟΘΕΟΣ] - ΖΑΠΠΕΙΟ" → "ΠΕΡΙΣΤΕΡΙ (ΑΓ. ΙΕΡΟΘΕΟΣ)",
 * "ΒΟΥΛΑ - ΠΕΙΡΑΙΑΣ [ΑΠΟ ΕΚΚΛΗΣΙΑ ΒΑΡΗΣ ΕΩΣ ΠΕΙΡΑΙΑ]" → "ΕΚΚΛΗΣΙΑ ΒΑΡΗΣ",
 * "ΤΟΠΙΚΗ ΗΡΑΚΛΕΙΟΥ [Εναλλακτική λόγω λαϊκής]" (circular, no terminals) → "ΤΟΠΙΚΗ ΗΡΑΚΛΕΙΟΥ".
 */
export function startingPoint(routeName: string): string {
  const variantStart = routeName.match(/\[ΑΠΟ (.+?)(?: ΕΩΣ .*)?\]/)
  if (variantStart) {
    return variantStart[1].trim()
  }
  const withoutNotes = routeName.replace(/(\s*\[[^\]]*\])+\s*$/, '')
  // Terminals are separated by a dash with a space on at least one side ("ΣΤ.ΔΟΥΚ.ΠΛΑΚΕΝΤΙΑΣ- Ν. ΖΩΗ")
  const [first] = withoutNotes.split(/\s+-\s*|\s*-\s+/)
  return first.replace(/\[([^\]]*)\]/g, '($1)').replace(/\s+/g, ' ').trim()
}

export function toScheduleDays(raw: IScheduleDay[] | null): ScheduleDay[] {
  return asList(raw).map((d) => ({
    code: d.sdc_code,
    name: d.sdc_descr,
    nameEn: d.sdc_descr_eng || null,
    label: scheduleDayLabel(d.sdc_descr_eng || d.sdc_descr),
  }))
}

// Day types seen in getScheduleDaysMasterline (Oct 2026), after the season is removed
const DAY_LABELS: Record<string, string> = {
  DAILY: 'Weekdays',
  SATURDAY: 'Saturday',
  SUNDAY: 'Sunday',
  'SATURDAY, SUNDAY': 'Weekend',
  'ALL DAYS': 'Every day',
  'MONDAY TO THURSDAY': 'Mon–Thu',
}

/** "WINTER DAILY" → "Weekdays", "WINTER SATURDAY, SUNDAY" → "Weekend" */
export function scheduleDayLabel(name: string): string {
  const day = name
    .toUpperCase()
    .replace(/^(WINTER|SUMMER)\s+/, '')
    .trim()
  if (DAY_LABELS[day]) {
    return DAY_LABELS[day]
  }
  return day.charAt(0) + day.slice(1).toLowerCase()
}

interface RawTimetable {
  go: { sde_start1: string | null }[]
  come: { sde_start2: string | null }[]
}

/**
 * Works for both getSchedLines and getDailySchedule. Each row is one vehicle doing up to two legs:
 * leg 1 from the first terminal (sde_start1) and leg 2 back from the other one (sde_start2).
 * OASA puts a row in `go` when its leg 1 is a passenger trip on this line and in `come` when its
 * leg 2 is, so a round trip appears in both lists. The other leg of a row can belong to another
 * line (a 229 bus continuing as 217, an Α7 bus continuing as night line 500) or, in
 * getDailySchedule, be flagged sdd_kp1/sdd_kp2 = "1" and left out, so `come[].sde_start1` and
 * `go[].sde_start2` must not be read: in a 47-line sample every extra time they add is one of those.
 * Rows repeat departure times and are not in time order.
 */
export function toTimetable(raw: RawTimetable | { error: string } | null): Timetable {
  if (raw && 'error' in raw) {
    throw new OasaApiError(`OASA: ${raw.error}`)
  }
  return {
    outbound: uniqueSortedTimes((raw?.go ?? []).map((e) => e.sde_start1)),
    inbound: uniqueSortedTimes((raw?.come ?? []).map((e) => e.sde_start2)),
  }
}

function uniqueSortedTimes(raw: (string | null)[]): ScheduleTime[] {
  const byMinute = new Map<number, ScheduleTime>()
  for (const value of raw) {
    const time = parseScheduleTime(value)
    if (time) {
      byMinute.set(time.minutesOfServiceDay, time)
    }
  }
  return [...byMinute.values()].sort((a, b) => a.minutesOfServiceDay - b.minutesOfServiceDay)
}
