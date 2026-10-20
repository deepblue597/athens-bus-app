// Builds public/data/stops.json: every stop on an OASA route, with the line numbers that serve it.
// The API has no "all stops" endpoint, so this walks lines → routes → stops (~1,200 requests, ~2 min).
// Runs nightly in .github/workflows/update-stops.yml; locally: `npm run build:stops`.
// STOPS_FORCE=1 replaces the file even when it shrank a lot (after checking that OASA really cut lines).
// Uses only Node built-ins, so it runs without `npm install`.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import type { StopsFile } from '../src/domain/stopsFile.ts'
import { parseList, shrinkError, toStopsFile, type RawLine, type RawRoute, type RawStop } from './stopsData.ts'

const API = 'https://telematics.oasa.gr/api/?act='
const OUTPUT = new URL('../public/data/stops.json', import.meta.url)
const USER_AGENT = 'athens-bus-app stops builder (+https://github.com/deepblue597/athens-bus-app)'
const CONCURRENCY = 3
/**
 * At most one request starts per interval (10/s). OASA's Apache starts answering 403 under load:
 * ~1% of requests at 30/s and ~3.5% at 80/s, none at 10/s (measured 2026-10-20).
 */
const MIN_INTERVAL_MS = 100
const ATTEMPTS = 4
const TIMEOUT_MS = 15_000

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

let nextStart = 0
async function throttle() {
  const now = Date.now()
  const wait = nextStart - now
  nextStart = Math.max(now, nextStart) + MIN_INTERVAL_MS
  if (wait > 0) await sleep(wait)
}

let retried = 0
async function request<T>(query: string): Promise<T[]> {
  let lastError: unknown
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    if (attempt > 1) {
      retried++
      // 2 s, 4 s, 8 s: long enough for a rate limit or a restart to pass
      await sleep(1000 * 2 ** (attempt - 1))
    }
    await throttle()
    try {
      const res = await fetch(API + query, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      const text = await res.text()
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      return parseList(text) as T[]
    } catch (err) {
      lastError = err
    }
  }
  throw new Error(`${query}: ${describeError(lastError)}`)
}

/** "fetch failed" alone says nothing; the network error behind it is in `cause` (ECONNRESET, ETIMEDOUT...) */
function describeError(err: unknown): string {
  if (!(err instanceof Error)) {
    return String(err)
  }
  const cause = err.cause as { code?: string; message?: string } | undefined
  return cause ? `${err.message} (${cause.code ?? cause.message ?? 'unknown cause'})` : err.message
}

/** Runs `fn` over `items` with at most `limit` in flight, keeping the order of `items` */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

async function main() {
  const started = Date.now()
  // Any request that still fails after its retries aborts the run, so a partial crawl never
  // replaces the file; the job fails and the next night tries again.
  const lines = await request<RawLine>('webGetLines')
  if (lines.length === 0) {
    throw new Error('webGetLines returned no lines')
  }
  const routesPerLine = await mapLimit(lines, CONCURRENCY, async (line) =>
    (await request<RawRoute>(`webGetRoutes&p1=${encodeURIComponent(line.LineCode)}`)).map((route) => ({ line, route })),
  )
  const routes = routesPerLine.flat().filter(({ route }) => typeof route?.RouteCode === 'string')
  const routeStops = await mapLimit(routes, CONCURRENCY, async ({ line, route }) => ({
    lineId: line.LineID,
    stops: await request<RawStop>(`webGetStops&p1=${encodeURIComponent(route.RouteCode)}`),
  }))

  const { file, skipped } = toStopsFile(routeStops)
  const previous = await readPrevious()
  const error = shrinkError(file, previous, process.env.STOPS_FORCE === '1')
  if (error) {
    throw new Error(`${error}; keeping the old file (STOPS_FORCE=1 overrides the comparison)`)
  }

  // No timestamp in the file, so it only changes (and gets committed) when the data does
  const json = JSON.stringify(file)
  const changed = json !== (previous ? JSON.stringify(previous) : '')
  if (changed) {
    await mkdir(new URL('.', OUTPUT), { recursive: true })
    await writeFile(OUTPUT, json + '\n')
  }
  const seconds = Math.round((Date.now() - started) / 1000)
  console.log(
    `${lines.length} lines, ${routes.length} routes, ${file.stops.length} stops in ${seconds}s ` +
      `(${retried} retries): ${changed ? 'updated' : 'unchanged'}`,
  )
  if (skipped.length > 0) {
    console.log(`Skipped ${skipped.length} stops: ${skipped.slice(0, 10).join('; ')}`)
  }
}

async function readPrevious(): Promise<StopsFile | null> {
  try {
    const file = JSON.parse(await readFile(OUTPUT, 'utf8')) as StopsFile
    return Array.isArray(file?.stops) ? file : null
  } catch {
    return null
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
