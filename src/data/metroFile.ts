import type { MetroLine, MetroNetwork, MetroPattern, MetroStation, MetroTrack } from '../domain/metro'
import { METRO_FILE_VERSION, type MetroFile } from '../domain/metroFile'
import { cumulativeLengths } from '../domain/polyline'
import { getJson, isNativeApp } from './oasa/client'

const FILE_PATH = '/data/metro.json'
/** The site rebuilds the timetable nightly; the Android app's own copy is as old as the app */
const SITE_FILE_URL = `https://bus.deepblue597.org${FILE_PATH}`
const SITE_TIMEOUT_MS = 15_000

export async function fetchMetroNetwork(): Promise<MetroNetwork> {
  if (isNativeApp) {
    try {
      return fromMetroFile(await getJson(SITE_FILE_URL, SITE_TIMEOUT_MS))
    } catch {
      // Offline, or the site's file is in a format this version can't read: use the built-in copy
    }
  }
  const res = await fetch(FILE_PATH)
  if (!res.ok) {
    throw new Error(`Couldn’t load the rail timetable (${res.status})`)
  }
  return fromMetroFile(await res.json())
}

export function fromMetroFile(data: unknown): MetroNetwork {
  const file = data as MetroFile
  if (file?.version !== METRO_FILE_VERSION) {
    throw new Error(`Unsupported timetable format (${String(file?.version)})`)
  }
  const lines: MetroLine[] = file.lines.map((l, index) => ({
    index,
    id: l.id,
    mode: l.mode,
    color: l.color,
    textColor: l.textColor,
    stations: l.stations,
    tracks: l.tracks.map(
      (t): MetroTrack => ({
        path: t.path,
        cumulative: cumulativeLengths(t.path),
        stationMetres: new Map(t.stops),
        first: t.stops[0]?.[0] ?? -1,
        last: t.stops[t.stops.length - 1]?.[0] ?? -1,
      }),
    ),
    departsTowards: new Map(),
  }))
  const stations: MetroStation[] = file.stations.map(([id, name, nameEn, lat, lng, board], index) => {
    const at = lines.filter((l) => l.stations.includes(index))
    return { index, id, name, nameEn, mode: at[0]?.mode ?? 'metro', lat, lng, lines: at.map((l) => l.index), board: board ?? null }
  })
  const patterns: MetroPattern[] = file.patterns.map((p) => {
    const track = lines[p.line].tracks[p.track]
    const metres = p.stations.map((s) => track.stationMetres.get(s) ?? 0)
    const forward = metres[metres.length - 1] > metres[0]
    return { line: p.line, track: p.track, stations: p.stations, metres, times: p.times, towards: forward ? track.last : track.first }
  })
  for (const p of patterns) {
    const towards = lines[p.line].departsTowards
    // Nothing departs from a trip's last stop
    for (const s of p.stations.slice(0, -1)) {
      const ends = towards.get(s) ?? []
      if (!ends.includes(p.towards)) {
        towards.set(s, [...ends, p.towards])
      }
    }
  }
  return {
    firstDate: file.firstDate,
    lastDate: file.lastDate,
    lines,
    stations,
    stationById: new Map(stations.map((s) => [s.id, s])),
    patterns,
    plans: file.plans,
    days: file.days,
  }
}
