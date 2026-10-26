// Pure parts of the metro build (scripts/build-metro.ts, scripts/fetch-metro-shapes.ts), kept apart so they can be tested
import {
  METRO_FILE_VERSION,
  type MetroFile,
  type MetroFileLine,
  type MetroFilePattern,
  type MetroFileStation,
  type MetroMode,
} from '../src/domain/metroFile.ts'
import { isWeekendOrHoliday } from '../src/domain/holidays.ts'
import { cumulativeLengths, pointAlong, projectOnto, segmentLength, type LngLat } from '../src/domain/polyline.ts'
import { parseClock, type ProastiakosTimetable } from './proastiakosData.ts'

/**
 * The lines shown, by the feed's route_short_name (the Proastiakos's by Hellenic Train's line names).
 * Metro colours are OpenStreetMap's (STASY's own maps use the same green, red and blue). OSM gives
 * both tram lines the tram's light green, too light for white text and the same for both, so they get
 * a teal and an orange-brown, unlike M1's green beside T7. The Proastiakos keeps OSM's (Hellenic
 * Train's) yellow, purple, light green and cyan, with dark text where white wouldn't read.
 */
export const METRO_LINES: readonly { id: string; mode: MetroMode; color: string; textColor: string }[] = [
  { id: 'M1', mode: 'metro', color: '#007a33', textColor: '#ffffff' },
  { id: 'M2', mode: 'metro', color: '#da291c', textColor: '#ffffff' },
  { id: 'M3', mode: 'metro', color: '#10069f', textColor: '#ffffff' },
  { id: 'T6', mode: 'tram', color: '#00796b', textColor: '#ffffff' },
  { id: 'T7', mode: 'tram', color: '#b05a00', textColor: '#ffffff' },
  { id: 'A1', mode: 'suburban', color: '#ffcd00', textColor: '#1a1a1a' },
  { id: 'A2', mode: 'suburban', color: '#9b26b6', textColor: '#ffffff' },
  { id: 'A3', mode: 'suburban', color: '#78be20', textColor: '#1a1a1a' },
  { id: 'A4', mode: 'suburban', color: '#00a3e0', textColor: '#1a1a1a' },
]

/**
 * Feed stop name → [id, name, English name], or null for a stop that isn't a passenger station. A
 * fourth item, [lat, lng], replaces a position the feed has wrong (and is the only position of a
 * Proastiakos station); a fifth is a Proastiakos station's OSE departures board.
 */
export type StationTable = Record<
  string,
  [string, string, string] | [string, string, string, [number, number]] | [string, string, string, [number, number], number] | null
>

/**
 * One table per mode: a tram stop and a metro station can share a name (Σύνταγμα) but not a place.
 * The Proastiakos's is only needed with its timetable.
 */
export type StationTables = Record<'metro' | 'tram', StationTable> & { suburban?: StationTable }

/**
 * A station further than this from a track isn't on it. Proastiakos stations can be large junctions:
 * at ΣΚΑ the A2's platforms are ~300 m from the A3's, and the station sits between them.
 */
const MAX_OFF_TRACK_M: Record<MetroMode, number> = { metro: 150, tram: 150, suburban: 250 }

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

/** Prefix of the made-up stop ids and trip ids the Proastiakos's trips get, beside the feed's */
const PROASTIAKOS = 'proastiakos:'

/**
 * Builds the metro file from STASY's GTFS feed, the line tracks (scripts/metro-shapes.json) and the
 * station tables, adding the Proastiakos when its timetable (scripts/proastiakos-timetable.json) is
 * given. It has no dates, only weekday and weekend trips, so it runs on the dates STASY's covers.
 */
export function toMetroFile(
  gtfs: GtfsFiles,
  shapes: Record<string, LngLat[][]>,
  tables: StationTables,
  proastiakos?: ProastiakosTimetable,
): MetroFile {
  // The Proastiakos's lines come last, so the metro's and tram's keep their indexes
  const shownLines = METRO_LINES.filter((l) => l.mode !== 'suburban' || proastiakos)
  const lineOfRoute = new Map<string, number>()
  readCsv(gtfs['routes.txt'], (f, col) => {
    const index = shownLines.findIndex((l) => l.mode !== 'suburban' && l.id === f[col('route_short_name')].trim())
    if (index >= 0) {
      lineOfRoute.set(f[col('route_id')], index)
    }
  })
  const tracks = shownLines.map((line) => {
    const paths = shapes[line.id]
    if (!paths || paths.length === 0) {
      throw new Error(`No tracks for ${line.id} in metro-shapes.json`)
    }
    return paths.map((path) => ({ path, cumulative: cumulativeLengths(path) }))
  })

  // Stations: the feed has a stop per platform, grouped here by name (interchanges included). Only
  // stops the lines' trips call at count, each looked up in its own mode's table.
  const stopRows = new Map<string, { name: string; point: LngLat }>()
  readCsv(gtfs['stops.txt'], (f, col) => {
    stopRows.set(f[col('stop_id')], { name: f[col('stop_name')].trim(), point: [Number(f[col('stop_lon')]), Number(f[col('stop_lat')])] })
  })
  const stations: { id: string; mode: MetroMode; name: string; nameEn: string; points: LngLat[] }[] = []
  const stationIndexById = new Map<string, number>()
  /** "mode|stop_id" → station index, or null for a stop that isn't a passenger station */
  const stationOfStop = new Map<string, number | null>()
  const missing = new Set<string>()
  /** Station index → its OSE departures board */
  const boards = new Map<number, number>()
  const stationFor = (stopId: string, mode: MetroMode): number | null | undefined => {
    const key = `${mode}|${stopId}`
    if (stationOfStop.has(key)) {
      return stationOfStop.get(key)
    }
    const stop = stopRows.get(stopId)
    const entry = stop && tables[mode]?.[stop.name]
    if (!stop || entry === undefined) {
      missing.add(stop ? `${stop.name} (${mode})` : `stop_id ${stopId} (not in stops.txt)`)
      return undefined
    }
    let index: number | null = null
    if (entry) {
      const [id, name, nameEn, fixed, board] = entry
      if (mode === 'suburban' && !fixed) {
        throw new Error(`${stop.name} has no position in scripts/proastiakos-stations.json`)
      }
      index = stationIndexById.get(id) ?? null
      if (index === null) {
        index = stations.push({ id, mode, name, nameEn, points: [] }) - 1
        stationIndexById.set(id, index)
      } else if (stations[index].mode !== mode) {
        throw new Error(`Station id "${id}" is used for both a ${stations[index].mode} and a ${mode} station`)
      }
      stations[index].points.push(fixed ? [fixed[1], fixed[0]] : stop.point)
      if (board !== undefined) {
        boards.set(index, board)
      }
    }
    stationOfStop.set(key, index)
    return index
  }

  // Trips of the lines shown
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
    const line = tripLine.get(tripId)
    if (line === undefined) {
      return
    }
    const station = stationFor(f[col('stop_id')], shownLines[line].mode)
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
  // The Proastiakos's trips, with a made-up stop per station name (the table has every position)
  for (const name of Object.keys(tables.suburban ?? {})) {
    stopRows.set(PROASTIAKOS + name, { name, point: [0, 0] })
  }
  proastiakos?.trips.forEach((trip, n) => {
    const line = shownLines.findIndex((l) => l.mode === 'suburban' && l.id === trip.line)
    if (line < 0) {
      throw new Error(`Unknown Proastiakos line ${trip.line}`)
    }
    const tripId = `${PROASTIAKOS}${n}`
    tripLine.set(tripId, line)
    tripService.set(tripId, PROASTIAKOS + trip.days)
    const list: TripStop[] = []
    trip.stops.forEach(([name, time], sequence) => {
      const station = stationFor(PROASTIAKOS + name, 'suburban')
      if (station === undefined || station === null) {
        missing.add(`${name} (suburban)`)
        return
      }
      const seconds = parseClock(time)
      list.push({ sequence, station, arrival: seconds, departure: seconds })
    })
    tripStops.set(tripId, list)
  })
  if (missing.size > 0) {
    throw new Error(`Stops missing from the station tables in scripts/: ${[...missing].join(', ')}`)
  }

  // Station positions: the platforms' average
  const positions: LngLat[] = stations.map((s) => [
    s.points.reduce((sum, p) => sum + p[0], 0) / s.points.length,
    s.points.reduce((sum, p) => sum + p[1], 0) / s.points.length,
  ])
  /** Where a station sits along a track, and how far off it */
  const placeCache = new Map<string, { metres: number; off: number }>()
  const place = (line: number, track: number, station: number) => {
    const key = `${line}|${track}|${station}`
    let placed = placeCache.get(key)
    if (!placed) {
      const { path, cumulative } = tracks[line][track]
      const metres = projectOnto(path, cumulative, positions[station])
      placed = { metres, off: segmentLength(pointAlong(path, cumulative, metres), positions[station]) }
      placeCache.set(key, placed)
    }
    return placed
  }
  /**
   * The track a stop sequence runs along: the first it follows forwards, else the first it follows
   * backwards (a metro line's one track serves both directions). Every station must be on it.
   */
  const trackCache = new Map<string, number>()
  const trackFor = (line: number, sequence: number[]): number => {
    const key = `${line}|${sequence.join(',')}`
    const cached = trackCache.get(key)
    if (cached !== undefined) {
      return cached
    }
    const runs = tracks[line].map((_, t) => {
      const placed = sequence.map((s) => place(line, t, s))
      if (placed.some((p) => p.off > MAX_OFF_TRACK_M[shownLines[line].mode])) {
        return 0
      }
      const steps = placed.slice(1).map((p, i) => p.metres - placed[i].metres)
      return steps.every((d) => d > 0) ? 1 : steps.every((d) => d < 0) ? -1 : 0
    })
    let track = runs.indexOf(1)
    if (track < 0) {
      track = runs.indexOf(-1)
    }
    if (track < 0) {
      const name = (s: number) => stations[s].name
      throw new Error(`A ${shownLines[line].id} trip ${name(sequence[0])} → ${name(sequence[sequence.length - 1])} follows none of its tracks`)
    }
    trackCache.set(key, track)
    return track
  }

  // Patterns: distinct (line, stations, timing) sequences; each trip is a pattern and a start time
  const patterns: MetroFilePattern[] = []
  const patternIndex = new Map<string, number>()
  const tripsByService = new Map<string, [number, number][]>()
  const trackStations = tracks.map((lineTracks) => lineTracks.map(() => new Set<number>()))
  for (const [tripId, list] of tripStops) {
    list.sort((a, b) => a.sequence - b.sequence)
    if (list.length < 2) {
      continue
    }
    const line = tripLine.get(tripId)!
    const start = list[0].arrival
    const sequence = list.map((s) => s.station)
    const times = list.flatMap((s) => [s.arrival - start, s.departure - start])
    const key = `${line}|${sequence.join(',')}|${times.join(',')}`
    let index = patternIndex.get(key)
    if (index === undefined) {
      const track = trackFor(line, sequence)
      index = patterns.push({ line, track, stations: sequence, times }) - 1
      patternIndex.set(key, index)
      sequence.forEach((s) => trackStations[line][track].add(s))
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
    throw new Error('The feed has no metro or tram trips')
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
  if (proastiakos) {
    for (const [date, services] of servicesByDate) {
      services.push(PROASTIAKOS + 'daily', PROASTIAKOS + (isWeekendOrHoliday(date) ? 'weekends' : 'weekdays'))
    }
  }
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
    throw new Error('The feed has no service days with metro or tram trips')
  }

  // Stations sorted by id, so the file doesn't depend on the order of the feed's rows
  const order = stations.map((_, i) => i).sort((a, b) => (stations[a].id < stations[b].id ? -1 : 1))
  const newIndex = new Array<number>(stations.length)
  order.forEach((old, i) => (newIndex[old] = i))
  for (const pattern of patterns) {
    pattern.stations = pattern.stations.map((s) => newIndex[s])
  }
  const fileStations: MetroFileStation[] = order.map((i): MetroFileStation => {
    const s = stations[i]
    const station: MetroFileStation = [s.id, s.name, s.nameEn, round(positions[i][1], 6), round(positions[i][0], 6)]
    const board = boards.get(i)
    return board === undefined ? station : [...station, board]
  })

  const lines: MetroFileLine[] = shownLines.map((meta, line) => {
    const lineTracks = tracks[line].map((track, t) => ({
      path: track.path,
      stops: [...trackStations[line][t]]
        .map((s): [number, number] => [newIndex[s], Math.round(place(line, t, s).metres)])
        .sort((a, b) => a[1] - b[1]),
    }))
    return {
      id: meta.id,
      mode: meta.mode,
      color: meta.color,
      textColor: meta.textColor,
      stations: listOrder(patterns.filter((p) => p.line === line), lineTracks[0].stops),
      tracks: lineTracks,
    }
  })

  return { version: METRO_FILE_VERSION, firstDate: dates[0], lastDate: dates[dates.length - 1], lines, stations: fileStations, patterns, plans, days }
}

/**
 * A line's stations as listed: its longest trips first (short trips can call at a stop out of the way,
 * such as T7's turn at ΣΕΦ), starting with the first track's, read from that track's start.
 */
function listOrder(patterns: MetroFilePattern[], firstTrack: [number, number][]): number[] {
  const metres = new Map(firstTrack)
  const sequences = patterns
    .map((p) => p.stations)
    .sort((a, b) => b.length - a.length || Number(metres.has(b[0])) - Number(metres.has(a[0])))
  const base = sequences.find((seq) => seq.every((s) => metres.has(s))) ?? sequences[0]
  if (!base) {
    return []
  }
  const forward = !metres.has(base[0]) || metres.get(base[0])! <= metres.get(base[base.length - 1])!
  return mergeStationOrders([forward ? base : [...base].reverse(), ...sequences])
}

/**
 * One list of a line's stations from several station orders: the first, with stations only in
 * others (one-way stops) put in before the next station they share. An order running the other way
 * (a tram line's return direction) is read backwards.
 */
export function mergeStationOrders(orders: number[][]): number[] {
  const nonEmpty = orders.filter((o) => o.length > 0)
  if (nonEmpty.length === 0) {
    return []
  }
  const merged = [...nonEmpty[0]]
  for (const order of nonEmpty.slice(1)) {
    const shared = order.filter((s) => merged.includes(s)).map((s) => merged.indexOf(s))
    const reversed = shared.length > 1 && shared[0] > shared[shared.length - 1]
    const list = reversed ? [...order].reverse() : order
    let pending: number[] = []
    for (const s of list) {
      const at = merged.indexOf(s)
      if (at >= 0) {
        merged.splice(at, 0, ...pending)
        pending = []
      } else {
        pending.push(s)
      }
    }
    merged.push(...pending)
  }
  return merged
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}
