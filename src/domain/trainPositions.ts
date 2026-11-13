import type { Departure, DepartureGroup, MetroLine, MetroNetwork, MetroPattern, TrainEstimate } from './metro'
import { pointAlong } from './polyline'
import { athensDate, athensTimeToEpoch } from './time'

// The metro and tram have no live positions, so trains are placed by STASY's timetable: a trip's times at each
// station say where it should be now. Trains run to headways and drift by a minute or two, so this
// gets the number and spacing of trains right more than any one train's exact place.

const HOUR_MS = 3_600_000

/** "2026-10-22" plus `days` */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/**
 * Epoch ms of a service day's 00:00:00 in GTFS terms: noon minus 12 hours. On the nights the clocks
 * change this isn't midnight, and trip times after midnight are counted from it, as the feed means.
 */
export function serviceDayStart(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return athensTimeToEpoch(y, m, d, 12, 0) - 12 * HOUR_MS
}

export interface PlanChoice {
  plan: number
  /** Set when the timetable doesn't cover the date: the date whose timetable stands in for it */
  standIn: string | null
}

/**
 * The timetable for a service date. Outside the dates STASY published, the closest published day of
 * the same weekday stands in (holidays and timetable changes are then missed).
 */
export function planFor(network: MetroNetwork, date: string): PlanChoice | null {
  const exact = network.days[date]
  if (exact !== undefined) {
    return { plan: exact, standIn: null }
  }
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay()
  const sameWeekday = Object.keys(network.days)
    .filter((d) => new Date(`${d}T00:00:00Z`).getUTCDay() === weekday)
    .sort()
  if (sameWeekday.length === 0) {
    return null
  }
  const before = sameWeekday.filter((d) => d < date)
  const standIn = before.length > 0 ? before[before.length - 1] : sameWeekday[0]
  return { plan: network.days[standIn], standIn }
}

/** Service days whose trips can be running at `now`: yesterday's run past midnight */
function serviceDays(nowMs: number, extra: number[] = []): string[] {
  const today = athensDate(nowMs)
  return [-1, 0, ...extra].map((n) => addDays(today, n))
}

/** Speeding up out of a station and braking into the next, instead of gliding at one speed */
const ease = (f: number) => f * f * (3 - 2 * f)

export function estimateTrains(network: MetroNetwork, nowMs: number): TrainEstimate[] {
  const trains: TrainEstimate[] = []
  for (const date of serviceDays(nowMs)) {
    const choice = planFor(network, date)
    if (!choice) {
      continue
    }
    const seconds = (nowMs - serviceDayStart(date)) / 1000
    const plan = network.plans[choice.plan]
    for (let i = 0; i < plan.length; i += 2) {
      const start = plan[i + 1]
      if (start > seconds) {
        break
      }
      const pattern = network.patterns[plan[i]]
      const estimate = locate(network, pattern, seconds - start)
      if (estimate) {
        trains.push({ ...estimate, key: `${date}:${i / 2}` })
      }
    }
  }
  return trains
}

function locate(network: MetroNetwork, pattern: MetroPattern, elapsed: number): Omit<TrainEstimate, 'key'> | null {
  const { stations, metres, times } = pattern
  const last = stations.length - 1
  if (elapsed < 0 || elapsed > times[2 * last]) {
    return null
  }
  const line = network.lines[pattern.line]
  const track = line.tracks[pattern.track]
  const destination = stations[last]
  for (let k = 0; k <= last; k++) {
    const arrival = times[2 * k]
    const departure = times[2 * k + 1]
    if (elapsed > departure) {
      continue
    }
    let along: number
    let from: number
    let to: number
    let atStation: boolean
    if (elapsed >= arrival || k === 0) {
      along = metres[k]
      from = stations[k]
      to = stations[Math.min(k + 1, last)]
      atStation = true
    } else {
      const left = times[2 * k - 1]
      const f = arrival === left ? 1 : (elapsed - left) / (arrival - left)
      along = metres[k - 1] + ease(f) * (metres[k] - metres[k - 1])
      from = stations[k - 1]
      to = stations[k]
      atStation = false
    }
    const [lng, lat] = pointAlong(track.path, track.cumulative, along)
    return { line: line.index, lng, lat, from, to, atStation, destination }
  }
  return null
}

/** Departures already this far in the past still show, as "now" */
const JUST_LEFT_MS = 30_000

/** The next `perGroup` trains from a station, per line and direction */
export function nextDepartures(network: MetroNetwork, station: number, nowMs: number, perGroup = 4): DepartureGroup[] {
  const groups = new Map<string, DepartureGroup>()
  // Tomorrow too, so late at night the first trains of the morning show
  for (const date of serviceDays(nowMs, [1])) {
    for (const { towards, departure } of serviceDayDepartures(network, station, date)?.departures ?? []) {
      if (departure.time >= nowMs - JUST_LEFT_MS) {
        addToGroup(groups, departure, towards)
      }
    }
  }
  return sortGroups(groups).map((g) => ({ ...g, departures: g.departures.slice(0, perGroup) }))
}

export interface DayTimetable {
  /** Every train per line and direction, earliest first */
  groups: DepartureGroup[]
  /** Set when the timetable doesn't cover the date: the date whose timetable stands in for it */
  standIn: string | null
}

/**
 * Every train leaving a station on an Athens calendar date, 00:00 to 23:59, per line and direction.
 * Service days overlap (Saturday-night trains run past dawn on Sunday), so the trains after midnight
 * of the day before are included and the date's own after midnight are left for the next date.
 */
export function dayTimetable(network: MetroNetwork, station: number, date: string): DayTimetable {
  const groups = new Map<string, DepartureGroup>()
  let standIn: string | null = null
  for (const serviceDate of [addDays(date, -1), date]) {
    const day = serviceDayDepartures(network, station, serviceDate)
    if (!day) {
      continue
    }
    // The date's own timetable is the one to name: the night before only adds its last trains
    if (serviceDate === date) {
      standIn = day.standIn
    }
    for (const { towards, departure } of day.departures) {
      if (athensDate(departure.time) === date) {
        addToGroup(groups, departure, towards)
      }
    }
  }
  return { groups: sortGroups(groups), standIn }
}

/** Every departure from a station in one service day, with the end of the line each heads for */
function serviceDayDepartures(
  network: MetroNetwork,
  station: number,
  date: string,
): { standIn: string | null; departures: { towards: number; departure: Departure }[] } | null {
  const choice = planFor(network, date)
  if (!choice) {
    return null
  }
  const dayStart = serviceDayStart(date)
  const plan = network.plans[choice.plan]
  const departures: { towards: number; departure: Departure }[] = []
  for (let i = 0; i < plan.length; i += 2) {
    const pattern = network.patterns[plan[i]]
    const k = pattern.stations.indexOf(station)
    // Trains end their trip at the last station: nothing departs from there
    if (k < 0 || k === pattern.stations.length - 1) {
      continue
    }
    departures.push({
      towards: pattern.towards,
      departure: {
        key: `${date}:${i / 2}`,
        line: pattern.line,
        destination: pattern.stations[pattern.stations.length - 1],
        time: dayStart + (plan[i + 1] + pattern.times[2 * k + 1]) * 1000,
      },
    })
  }
  return { standIn: choice.standIn, departures }
}

/** Grouped by the end of the line trains head for: a tram line's two directions run on two tracks */
function addToGroup(groups: Map<string, DepartureGroup>, departure: Departure, towards: number) {
  const groupKey = `${departure.line}:${towards}`
  let group = groups.get(groupKey)
  if (!group) {
    group = { line: departure.line, towards, departures: [] }
    groups.set(groupKey, group)
  }
  group.departures.push(departure)
}

function sortGroups(groups: Map<string, DepartureGroup>): DepartureGroup[] {
  return [...groups.values()]
    .map((g) => ({ ...g, departures: g.departures.sort((a, b) => a.time - b.time) }))
    .sort((a, b) => a.line - b.line || a.towards - b.towards)
}

export interface TimetableNotice {
  firstDate: string
  lastDate: string
  /** Today's stand-in date */
  standIn: string
}

/** Set when today isn't in STASY's published timetable, so the app says it's showing another day's */
export function timetableNotice(network: MetroNetwork, nowMs: number): TimetableNotice | null {
  const today = athensDate(nowMs)
  const choice = planFor(network, today)
  if (!choice || choice.standIn === null) {
    return null
  }
  return { firstDate: network.firstDate, lastDate: network.lastDate, standIn: choice.standIn }
}

/**
 * The one end trains leave a stop towards, for a stop along the way served in one direction only
 * (T7's loop through Piraeus); null elsewhere, termini included.
 */
export function oneWayTowards(line: MetroLine, station: number): number | null {
  const ends = line.departsTowards.get(station) ?? []
  const terminus = station === line.stations[0] || station === line.stations[line.stations.length - 1]
  return ends.length === 1 && !terminus ? ends[0] : null
}
