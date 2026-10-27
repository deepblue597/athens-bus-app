// Anti-corruption layer for OSE's station boards (ose.mpass.ltd): each train comes twice, in Greek
// and English, with Oracle-style field names, times as "  4:33" in Athens time and the date only in
// another field, and the delay as a string of minutes.
import type { BoardTrain, StationBoard } from '../../domain/stationBoard'
import { athensDate, athensTimeToEpoch } from '../../domain/time'

export class OseError extends Error {
  name = 'OseError'
}

/** The fields the app reads; every one may be null */
export interface RawBoardRoute {
  /** Train number, with a trailing space ("3200 ") */
  TRENO?: unknown
  /** Operator, "HELLENIC TRAIN" */
  RUP?: unknown
  /** "Ρέντης - Αεροδρόμιο", with remarks in capitals after it: "… (ΚΑΤΑΡΓΗΣΗ ΔΡΟΜΟΛΟΓΙΟΥ)" */
  FROMTO?: unknown
  /** "1", or "-" when not announced */
  DR_PLATFORM?: unknown
  /** Scheduled arrival, "  4:33"; null where the train starts */
  DR_TAFIX?: unknown
  /** Scheduled departure, "  4:34"; null where the train ends */
  DR_TANA?: unknown
  /** UTC, a few minutes around the scheduled time: only its date is used */
  DR_FORECASTED_DATE?: unknown
  /** Minutes late ("0"), as the station screens show it */
  PREVIOUSDELAY9?: unknown
  /** "PASSENGERS" */
  PASSENGER_FREIGHTS?: unknown
}

interface RawBoard {
  routes?: unknown
  announcements?: unknown
}

export function toStationBoard(raw: unknown): StationBoard {
  const board = raw as RawBoard | null
  if (typeof board !== 'object' || board === null || !Array.isArray(board.routes)) {
    throw new OseError(`Unexpected OSE response: ${JSON.stringify(raw)?.slice(0, 100)}`)
  }
  const trains = board.routes.map(toBoardTrain).filter((t): t is BoardTrain => t !== null)
  // Trains none of which could be read means the format changed, not that none are coming
  if (board.routes.length > 0 && trains.length === 0) {
    throw new OseError('OSE sent trains in a format the app doesn’t understand')
  }
  const notices = (Array.isArray(board.announcements) ? board.announcements : [])
    .map((a) => (typeof a === 'object' && a !== null && typeof (a as { text?: unknown }).text === 'string' ? (a as { text: string }).text.trim() : ''))
    .filter((text) => text !== '')
  return { trains: trains.sort((a, b) => a.scheduled - b.scheduled), notices }
}

function toBoardTrain(raw: unknown): BoardTrain | null {
  const route = raw as { routesEl?: RawBoardRoute; routesEn?: RawBoardRoute } | null
  const el = route?.routesEl
  if (!el) {
    return null
  }
  const en = route.routesEn ?? el
  if (typeof el.PASSENGER_FREIGHTS === 'string' && /FREIGHT/i.test(el.PASSENGER_FREIGHTS)) {
    return null
  }
  const train = text(el.TRENO)
  const departure = clock(el.DR_TANA)
  const time = departure ?? clock(el.DR_TAFIX)
  const around = typeof el.DR_FORECASTED_DATE === 'string' ? Date.parse(el.DR_FORECASTED_DATE) : NaN
  if (!train || !time || Number.isNaN(around)) {
    return null
  }
  const { route: fromTo, remark } = splitRemark(text(el.FROMTO))
  const ends = endsOf(fromTo)
  const endsEn = endsOf(splitRemark(text(en.FROMTO)).route)
  const cancelled = remark !== null && CANCELLED.test(remark)
  const platform = text(el.DR_PLATFORM)
  const delay = Number.parseInt(text(el.PREVIOUSDELAY9), 10)
  return {
    train,
    operator: text(el.RUP),
    origin: ends[0],
    originEn: titleCase(endsEn[0] || ends[0]),
    destination: ends[1],
    destinationEn: titleCase(endsEn[1] || ends[1]),
    platform: platform && platform !== '-' ? platform : null,
    scheduled: nearest(time, around),
    delayMinutes: Number.isFinite(delay) && delay > 0 ? delay : 0,
    terminates: departure === null,
    cancelled,
    remark: cancelled ? null : remark,
  }
}

/** A whole train cancelled. A partial cancellation ("ΜΕΡΙΚΗ ΚΑΤΑΡΓΗΣΗ") would stay a remark, as the screens word it */
const CANCELLED = /^ΚΑΤΑΡΓΗΣΗ ΔΡΟΜΟΛΟΓΙΟΥ$/

/**
 * The screens add remarks to the route in capitals and parentheses:
 * "Αθήνα - Θεσσαλονίκη Επιβατικός (ΚΑΤΑΡΓΗΣΗ ΔΡΟΜΟΛΟΓΙΟΥ)". A parenthesis in mixed case is part of a name.
 */
function splitRemark(fromTo: string): { route: string; remark: string | null } {
  const match = /^(.*?)\s*\(([^()]+)\)$/u.exec(fromTo)
  if (!match || match[2] !== match[2].toUpperCase() || !/\p{L}/u.test(match[2])) {
    return { route: fromTo, remark: null }
  }
  return { route: match[1], remark: match[2].trim().replace(/\s+/g, ' ') }
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** "  4:33" (sometimes "4.33") → [4, 33] */
function clock(value: unknown): [number, number] | null {
  const match = /^(\d{1,2})[:.](\d\d)$/.exec(text(value))
  if (!match) {
    return null
  }
  const [h, m] = [Number(match[1]), Number(match[2])]
  return h < 24 && m < 60 ? [h, m] : null
}

/** "Ρέντης - Αεροδρόμιο" → ["Ρέντης", "Αεροδρόμιο"]; the M3's "Πειραιάς Κέντρο - Δημοτικό Θέατρο - Αεροδρόμιο" has three parts */
function endsOf(value: unknown): [string, string] {
  const parts = text(value).split(/\s+-\s+/)
  return [parts[0] ?? '', parts[parts.length - 1] ?? '']
}

/** "PIRAEUS Suburban" → "Piraeus Suburban" */
function titleCase(value: string): string {
  return value.toLowerCase().replace(/(^|[\s(-])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toUpperCase())
}

/** The Athens wall-clock time closest to `around`: the board gives no date with its times */
function nearest([h, m]: [number, number], around: number): number {
  const date = athensDate(around)
  const [y, mo, d] = date.split('-').map(Number)
  return [-1, 0, 1]
    .map((days) => athensTimeToEpoch(y, mo, d + days, h, m))
    .reduce((best, t) => (Math.abs(t - around) < Math.abs(best - around) ? t : best))
}
