import type { Departure, DepartureGroup, MetroNetwork, MetroPattern, TrainEstimate } from './metro'
import { pointAlong } from './polyline'
import { athensDate, athensTimeToEpoch } from './time'

// The metro has no live positions, so trains are placed by STASY's timetable: a trip's times at each
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
    const [lng, lat] = pointAlong(line.path, line.cumulative, along)
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
    const choice = planFor(network, date)
    if (!choice) {
      continue
    }
    const dayStart = serviceDayStart(date)
    const plan = network.plans[choice.plan]
    for (let i = 0; i < plan.length; i += 2) {
      const pattern = network.patterns[plan[i]]
      const k = pattern.stations.indexOf(station)
      // Trains end their trip at the last station: nothing departs from there
      if (k < 0 || k === pattern.stations.length - 1) {
        continue
      }
      const time = dayStart + (plan[i + 1] + pattern.times[2 * k + 1]) * 1000
      if (time < nowMs - JUST_LEFT_MS) {
        continue
      }
      const line = network.lines[pattern.line]
      const forward = pattern.metres[k + 1] > pattern.metres[k]
      const groupKey = `${line.index}:${forward ? 1 : -1}`
      let group = groups.get(groupKey)
      if (!group) {
        group = { line: line.index, towards: forward ? line.stations[line.stations.length - 1] : line.stations[0], departures: [] }
        groups.set(groupKey, group)
      }
      const departure: Departure = { key: `${date}:${i / 2}`, line: line.index, destination: pattern.stations[pattern.stations.length - 1], time }
      group.departures.push(departure)
    }
  }
  return [...groups.values()]
    .map((g) => ({ ...g, departures: g.departures.sort((a, b) => a.time - b.time).slice(0, perGroup) }))
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
