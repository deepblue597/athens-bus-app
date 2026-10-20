// Pure parts of scripts/build-stops.ts (no network or files), so they can be tested offline.
// Node runs this file directly: imports need explicit .ts extensions and only erasable TypeScript.
import type { StopsFile, StopsFileRow } from '../src/domain/stopsFile.ts'

export interface RawLine {
  LineCode: string
  LineID: string
}

export interface RawRoute {
  RouteCode: string
}

export interface RawStop {
  StopCode: string
  StopID: string
  StopDescr: string
  StopDescrEng: string | null
  StopLat: string
  StopLng: string
}

/** The stops of one route and the line number it belongs to, in crawl order */
export interface RouteStops {
  lineId: string
  stops: RawStop[]
}

/** A run that finds fewer than this is broken whatever the previous file says (e.g. the first run) */
export const MIN_STOPS = 5000
/** Refuse to replace the file when a run finds far fewer stops or line-stop links than last time */
export const MIN_KEPT_RATIO = 0.9

/**
 * Generous box around Attica. Rows outside it are OASA test stops (some sit at 0,0) or have
 * latitude and longitude swapped; the real stops span 37.71–38.33 N, 23.32–24.06 E.
 */
const BOUNDS = { minLat: 37.3, maxLat: 38.7, minLng: 22.8, maxLng: 24.6 }

/**
 * Parses an OASA response body. Every response is HTTP 200: "nothing found" is null (or "" on some
 * endpoints) and errors are {"error": "..."}. Under load OASA's Apache answers 403 with an HTML page,
 * which the caller sees as a non-OK status before getting here.
 */
export function parseList(text: string): unknown[] {
  const body: unknown = JSON.parse(text)
  if (Array.isArray(body)) return body
  if (body === null || body === '') return []
  throw new Error(`unexpected response ${JSON.stringify(body).slice(0, 80)}`)
}

const clean = (value: unknown) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '')

/**
 * Merges the stops of every route into sorted file rows. Routes are taken in crawl order, so when two
 * routes disagree about a stop the same one wins on every run (the output must not depend on which
 * request finished first, or the nightly job would commit noise).
 */
export function toStopsFile(routes: RouteStops[]): { file: StopsFile; skipped: string[] } {
  const merged = new Map<string, { row: StopsFileRow; lines: Set<string> }>()
  const skipped: string[] = []
  for (const { lineId, stops } of routes) {
    const line = clean(lineId)
    for (const stop of stops) {
      const code = clean(stop?.StopCode)
      if (!code) {
        skipped.push(`stop without a code on line ${line}`)
        continue
      }
      let entry = merged.get(code)
      if (!entry) {
        const lat = Number(Number(stop.StopLat).toFixed(6))
        const lng = Number(Number(stop.StopLng).toFixed(6))
        if (!(lat >= BOUNDS.minLat && lat <= BOUNDS.maxLat && lng >= BOUNDS.minLng && lng <= BOUNDS.maxLng)) {
          skipped.push(`${code} at ${stop.StopLat},${stop.StopLng}`)
          continue
        }
        const nameEn = clean(stop.StopDescrEng) || null
        const row: StopsFileRow = [code, clean(stop.StopID), clean(stop.StopDescr) || nameEn || code, nameEn, lat, lng, []]
        entry = { row, lines: new Set() }
        merged.set(code, entry)
      }
      if (line) entry.lines.add(line)
    }
  }
  const stops = [...merged.values()]
    .map(({ row, lines }): StopsFileRow => {
      row[6] = [...lines].sort(byLineNumber)
      return row
    })
    .sort((a, b) => compareCodes(a[0], b[0]))
  return { file: { version: 1, stops }, skipped: [...new Set(skipped)] }
}

/** Line numbers in reading order: 040 < 400, Α1 < Α2 < Β1 */
const byLineNumber = (a: string, b: string) => a.localeCompare(b, 'el', { numeric: true }) || (a < b ? -1 : a > b ? 1 : 0)

/** Numeric codes in numeric order ("-2" first); plain comparison for anything else, so the order is total */
function compareCodes(a: string, b: string): number {
  const diff = Number(a) - Number(b)
  if (Number.isFinite(diff) && diff !== 0) return diff
  return a < b ? -1 : a > b ? 1 : 0
}

const linkCount = (file: StopsFile) => file.stops.reduce((sum, row) => sum + row[6].length, 0)

/**
 * Why `next` must not replace `previous`, or null when it can. Counting line-stop links as well as
 * stops catches runs that lose whole lines: their stops are mostly served by other lines too.
 * `force` skips the comparison with the previous file, for when OASA really did cut the network.
 */
export function shrinkError(next: StopsFile, previous: StopsFile | null, force = false): string | null {
  if (next.stops.length < MIN_STOPS) {
    return `only ${next.stops.length} stops (expected at least ${MIN_STOPS})`
  }
  if (!previous || force) return null
  if (next.stops.length < previous.stops.length * MIN_KEPT_RATIO) {
    return `only ${next.stops.length} stops, down from ${previous.stops.length}`
  }
  const links = linkCount(next)
  const previousLinks = linkCount(previous)
  if (links < previousLinks * MIN_KEPT_RATIO) {
    return `only ${links} line-stop links, down from ${previousLinks}`
  }
  return null
}
