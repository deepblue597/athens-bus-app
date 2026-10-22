// Pure parts of the metro build (scripts/build-metro.ts, scripts/fetch-metro-shapes.ts), kept apart so they can be tested
import type { MetroFile, MetroFileLine, MetroFilePattern, MetroFileStation } from '../src/domain/metroFile.ts'
import { cumulativeLengths, projectOnto, segmentLength, type LngLat } from '../src/domain/polyline.ts'

/** Line colours from OpenStreetMap's route relations (STASY's own maps use the same green, red and blue) */
export const METRO_LINES = [
  { id: 'M1', color: '#007a33' },
  { id: 'M2', color: '#da291c' },
  { id: 'M3', color: '#10069f' },
] as const

/** Feed stop name → [id, name, English name], or null for a stop that isn't a passenger station */
export type StationTable = Record<string, [string, string, string] | null>

/**
 * Calls `onRow` for each CSV row (header excluded) with its fields. Handles quoted fields, CRLF and a
 * byte-order mark. Rows go to the callback instead of an array because stop_times.txt has ~1.8 million.
 */
export function readCsv(text: string, onRow: (fields: string[], column: (name: string) => number) => void) {
  let header: string[] | null = null
  const columns = new Map<string, number>()
  const column = (name: string) => {
    const index = columns.get(name)
    if (index === undefined) {
      throw new Error(`Missing column "${name}"`)
    }
    return index
  }
  let fields: string[] = []
  let field = ''
  let quoted = false
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0
  const endRow = () => {
    fields.push(field)
    field = ''
    if (!header) {
      header = fields
      header.forEach((name, index) => columns.set(name.trim(), index))
    } else if (fields.length > 1 || fields[0] !== '') {
      onRow(fields, column)
    }
    fields = []
  }
  for (; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      quoted = true
    } else if (c === ',') {
      fields.push(field)
      field = ''
    } else if (c === '\n') {
      endRow()
    } else if (c !== '\r') {
      field += c
    }
  }
  if (field !== '' || fields.length > 0) {
    endRow()
  }
}

/** "25:04:30" → seconds since the service day's start (GTFS times pass 24:00 after midnight) */
export function parseGtfsTime(time: string): number {
  const [h, m, s] = time.trim().split(':').map(Number)
  if (![h, m, s].every(Number.isFinite)) {
    throw new Error(`Bad time "${time}"`)
  }
  return h * 3600 + m * 60 + s
}

/** "20261022" → "2026-10-22" */
function isoDate(gtfsDate: string): string {
  return `${gtfsDate.slice(0, 4)}-${gtfsDate.slice(4, 6)}-${gtfsDate.slice(6, 8)}`
}

const JOIN_TOLERANCE_M = 5
const MAX_GAP_M = 300

/**
 * Joins an OSM route relation's track ways, listed in route order but each drawn in either direction,
 * into one path. Small gaps (a missing way at a junction) are bridged; a large one means the relation
 * is broken, which would draw trains across town.
 */
export function stitchWays(ways: LngLat[][]): LngLat[] {
  const usable = ways.filter((w) => w.length >= 2)
  if (usable.length === 0) {
    throw new Error('No ways to join')
  }
  let path = [...usable[0]]
  if (usable.length > 1) {
    const next = usable[1]
    const gapFromEnd = Math.min(segmentLength(path[path.length - 1], next[0]), segmentLength(path[path.length - 1], next[next.length - 1]))
    const gapFromStart = Math.min(segmentLength(path[0], next[0]), segmentLength(path[0], next[next.length - 1]))
    if (gapFromStart < gapFromEnd) {
      path.reverse()
    }
  }
  for (const way of usable.slice(1)) {
    const end = path[path.length - 1]
    const forward = segmentLength(end, way[0])
    const backward = segmentLength(end, way[way.length - 1])
    const gap = Math.min(forward, backward)
    if (gap > MAX_GAP_M) {
      throw new Error(`Ways don't join: a ${Math.round(gap)} m gap at ${end.join(',')}`)
    }
    const oriented = forward <= backward ? way : [...way].reverse()
    path = path.concat(gap <= JOIN_TOLERANCE_M ? oriented.slice(1) : oriented)
  }
  return path
}

export interface GtfsFiles {
  'routes.txt': string
  'trips.txt': string
  'stop_times.txt': string
  'stops.txt': string
  'calendar_dates.txt': string
}

interface TripStop {
  sequence: number
  station: number
  arrival: number
  departure: number
}

/** Builds the metro file from STASY's GTFS feed, the line paths (scripts/metro-shapes.json) and the station table */
export function toMetroFile(gtfs: GtfsFiles, shapes: Record<string, LngLat[]>, stationTable: StationTable): MetroFile {
  // Lines: the feed's M1–M3 (it also has the tram, which isn't shown yet)
  const lineOfRoute = new Map<string, number>()
  readCsv(gtfs['routes.txt'], (f, col) => {
    const index = METRO_LINES.findIndex((l) => l.id === f[col('route_short_name')].trim())
    if (index >= 0) {
      lineOfRoute.set(f[col('route_id')], index)
    }
  })
  for (const line of METRO_LINES) {
    if (!shapes[line.id]) {
      throw new Error(`No path for ${line.id} in metro-shapes.json`)
    }
  }

  // Stations: the feed has a stop per platform, grouped here by name (interchanges included). Only
  // stops metro trains call at count: the tram's stops share some names (Σύνταγμα) but not places.
  const stopRows = new Map<string, { name: string; point: LngLat }>()
  readCsv(gtfs['stops.txt'], (f, col) => {
    stopRows.set(f[col('stop_id')], { name: f[col('stop_name')].trim(), point: [Number(f[col('stop_lon')]), Number(f[col('stop_lat')])] })
  })
  const stations: { id: string; name: string; nameEn: string; points: LngLat[] }[] = []
  const stationIndexById = new Map<string, number>()
  /** stop_id → station index, or null for a stop that isn't a passenger station */
  const stationOfStop = new Map<string, number | null>()
  const missing = new Set<string>()
  const stationFor = (stopId: string): number | null | undefined => {
    if (stationOfStop.has(stopId)) {
      return stationOfStop.get(stopId)
    }
    const stop = stopRows.get(stopId)
    const entry = stop && stationTable[stop.name]
    if (!stop || entry === undefined) {
      missing.add(stop ? stop.name : `stop_id ${stopId} (not in stops.txt)`)
      return undefined
    }
    let index: number | null = null
    if (entry) {
      const [id, name, nameEn] = entry
      index = stationIndexById.get(id) ?? null
      if (index === null) {
        index = stations.push({ id, name, nameEn, points: [] }) - 1
        stationIndexById.set(id, index)
      }
      stations[index].points.push(stop.point)
    }
    stationOfStop.set(stopId, index)
    return index
  }

  // Trips of the metro lines
  const tripLine = new Map<string, number>()
  const tripService = new Map<string, string>()
  readCsv(gtfs['trips.txt'], (f, col) => {
    const line = lineOfRoute.get(f[col('route_id')])
    if (line !== undefined) {
      tripLine.set(f[col('trip_id')], line)
      tripService.set(f[col('trip_id')], f[col('service_id')])
    }
  })
  const tripStops = new Map<string, TripStop[]>()
  readCsv(gtfs['stop_times.txt'], (f, col) => {
    const tripId = f[col('trip_id')]
    if (!tripLine.has(tripId)) {
      return
    }
    const station = stationFor(f[col('stop_id')])
    if (station === undefined || station === null) {
      return
    }
    let list = tripStops.get(tripId)
    if (!list) {
      list = []
      tripStops.set(tripId, list)
    }
    list.push({
      sequence: Number(f[col('stop_sequence')]),
      station,
      arrival: parseGtfsTime(f[col('arrival_time')]),
      departure: parseGtfsTime(f[col('departure_time')]),
    })
  })
  if (missing.size > 0) {
    throw new Error(`Stations missing from scripts/metro-stations.json: ${[...missing].join(', ')}`)
  }

  // Patterns: distinct (line, stations, timing) sequences; each trip is a pattern and a start time
  const patterns: MetroFilePattern[] = []
  const patternIndex = new Map<string, number>()
  const tripsByService = new Map<string, [number, number][]>()
  const lineStations = METRO_LINES.map(() => new Set<number>())
  for (const [tripId, list] of tripStops) {
    list.sort((a, b) => a.sequence - b.sequence)
    if (list.length < 2) {
      continue
    }
    const line = tripLine.get(tripId)!
    const start = list[0].arrival
    const pattern: MetroFilePattern = {
      line,
      stations: list.map((s) => s.station),
      times: list.flatMap((s) => [s.arrival - start, s.departure - start]),
    }
    const key = `${line}|${pattern.stations.join(',')}|${pattern.times.join(',')}`
    let index = patternIndex.get(key)
    if (index === undefined) {
      index = patterns.push(pattern) - 1
      patternIndex.set(key, index)
      pattern.stations.forEach((s) => lineStations[line].add(s))
    }
    const service = tripService.get(tripId)!
    let trips = tripsByService.get(service)
    if (!trips) {
      trips = []
      tripsByService.set(service, trips)
    }
    trips.push([index, start])
  }
  if (patterns.length === 0) {
    throw new Error('The feed has no metro trips')
  }

  // Days: each date's trips, with identical days sharing one plan
  const servicesByDate = new Map<string, string[]>()
  readCsv(gtfs['calendar_dates.txt'], (f, col) => {
    if (f[col('exception_type')].trim() !== '1') {
      return
    }
    const date = isoDate(f[col('date')].trim())
    servicesByDate.set(date, [...(servicesByDate.get(date) ?? []), f[col('service_id')].trim()])
  })
  const plans: number[][] = []
  const planIndex = new Map<string, number>()
  const days: Record<string, number> = {}
  for (const date of [...servicesByDate.keys()].sort()) {
    const trips = servicesByDate
      .get(date)!
      .flatMap((service) => tripsByService.get(service) ?? [])
      .sort((a, b) => a[1] - b[1] || a[0] - b[0])
    if (trips.length === 0) {
      continue
    }
    const plan = trips.flat()
    const key = plan.join(',')
    let index = planIndex.get(key)
    if (index === undefined) {
      index = plans.push(plan) - 1
      planIndex.set(key, index)
    }
    days[date] = index
  }
  const dates = Object.keys(days).sort()
  if (dates.length === 0) {
    throw new Error('The feed has no service days with metro trips')
  }

  // Stations sorted by id, so the file doesn't depend on the order of the feed's rows
  const order = stations.map((_, i) => i).sort((a, b) => (stations[a].id < stations[b].id ? -1 : 1))
  const newIndex = new Array<number>(stations.length)
  order.forEach((old, i) => (newIndex[old] = i))
  for (const pattern of patterns) {
    pattern.stations = pattern.stations.map((s) => newIndex[s])
  }
  const sortedLineStations = lineStations.map((set) => new Set([...set].map((s) => newIndex[s])))

  // Station positions: the platforms' average, and where each station sits along its lines
  const fileStations: MetroFileStation[] = order.map((i) => stations[i]).map((s) => {
    const lng = s.points.reduce((sum, p) => sum + p[0], 0) / s.points.length
    const lat = s.points.reduce((sum, p) => sum + p[1], 0) / s.points.length
    return [s.id, s.name, s.nameEn, round(lat, 6), round(lng, 6)]
  })
  const lines: MetroFileLine[] = METRO_LINES.map((meta, index) => {
    const path = shapes[meta.id]
    const cumulative = cumulativeLengths(path)
    const stops = [...sortedLineStations[index]]
      .map((station): [number, number] => {
        const [, , , lat, lng] = fileStations[station]
        return [station, Math.round(projectOnto(path, cumulative, [lng, lat]))]
      })
      .sort((a, b) => a[1] - b[1])
    return { id: meta.id, color: meta.color, path, stops }
  })

  return { version: 1, firstDate: dates[0], lastDate: dates[dates.length - 1], lines, stations: fileStations, patterns, plans, days }
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}
