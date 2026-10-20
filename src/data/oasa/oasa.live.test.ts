// Opt-in smoke test against the real OASA API: `npm run test:live`.
// Skipped by `npm test` so the regular suite (and CI) never touches the network.
import { describe, expect, it } from 'vitest'
import { APIRequests, type RequestFunction } from 'oasa-telematics-api'
import { ATHENS_CENTER } from '../../domain/geo'
import { asList, OasaApiError, toArrivals, toNearbyStops, toStopRoutes, withRoutes } from './adapters'
import { toLineDirections, toLines, toScheduleDays, toTimetable } from './lineAdapters'

const live = Boolean(import.meta.env.OASA_LIVE)

// Calls OASA directly (no CORS in Node) and fails loudly on anything that isn't JSON
const request: RequestFunction = async <T>(url: string, query: string): Promise<T> => {
  const res = await fetch(url + query, { signal: AbortSignal.timeout(10_000) })
  expect(res.status, query).toBe(200)
  const text = await res.text()
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`"${query}" did not return JSON: ${text.slice(0, 100)}`)
  }
}
const api = new APIRequests(request)

describe.skipIf(!live)('OASA live API', { timeout: 60_000 }, () => {
  it('finds stops near Syntagma with usable coordinates', async () => {
    const raw = await api.getClosestStops(String(ATHENS_CENTER.lat), String(ATHENS_CENTER.lng))
    expect(raw).toHaveLength(20)
    const stops = toNearbyStops(raw, ATHENS_CENTER, 1500)
    expect(stops.length).toBeGreaterThan(5)
    for (const s of stops) {
      expect(Number.isFinite(s.lat) && Number.isFinite(s.lng), s.code).toBe(true)
      expect(s.code).toMatch(/^\d+$/)
    }
  })

  it('returns arrivals and routes the adapters can join', async () => {
    const stops = toNearbyStops(
      await api.getClosestStops(String(ATHENS_CENTER.lat), String(ATHENS_CENTER.lng)),
      ATHENS_CENTER,
      1500,
    )
    let arrivalCount = 0
    let unmatched = 0
    for (const stop of stops.slice(0, 5)) {
      const arrivals = toArrivals(await api.getStopArrivals(stop.code))
      const routes = toStopRoutes(await api.webRoutesForStop(stop.code))
      const joined = withRoutes(arrivals, routes)
      expect(new Set(joined.map((a) => `${a.routeCode}-${a.vehicleCode}`)).size).toBe(joined.length)
      for (const a of joined) {
        expect(Number.isInteger(a.minutes) && a.minutes >= 0, JSON.stringify(a)).toBe(true)
      }
      expect(new Set(routes.map((r) => r.routeCode)).size).toBe(routes.length)
      arrivalCount += joined.length
      unmatched += joined.filter((a) => a.route === null).length
    }
    // In probing, every arrival's route was in the stop's route list (0 of 411)
    expect(unmatched).toBeLessThanOrEqual(Math.ceil(arrivalCount * 0.1))
  })

  it('answers an unknown stop with null, which maps to empty lists', async () => {
    expect(toArrivals(await api.getStopArrivals('99999999'))).toEqual([])
    expect(toStopRoutes(await api.webRoutesForStop('99999999'))).toEqual([])
  })

  it('answers getBusLocation for a route with no buses with "" rather than null', async () => {
    const raw = await api.getBusLocation('99999999')
    expect(raw).toBe('')
    expect(asList(raw)).toEqual([])
  })

  it('splits timetables by leg: go rows start on this line, come rows return on it', async () => {
    // toTimetable reads only go[].sde_start1 and come[].sde_start2; this checks why that is safe.
    // 040 (two-way, 24h), 217 (shares buses with 229), 300 (circular), 500 (night only)
    const lines = toLines(await api.webGetLinesWithMLInfo()).filter((l) => ['938', '1033', '885', '877'].includes(l.code))
    expect(lines).toHaveLength(4)
    for (const line of lines) {
      const days = toScheduleDays(await api.getScheduleDaysMasterline(line.code))
      expect(days.length, line.id).toBeGreaterThan(0)
      const raw = (await api.getSchedLines(line.masterCode, days[0].code, line.code)) as unknown as {
        go: { sde_line1: string | null; sde_start1: string | null }[]
        come: { sde_line2: string | null; sde_start2: string | null }[]
      }
      for (const row of raw.go) expect(row.sde_line1, `${line.id} go`).toBe(line.code)
      for (const row of raw.come) expect(row.sde_line2, `${line.id} come`).toBe(line.code)
      const timetable = toTimetable(raw as never)
      expect(timetable.outbound.length, line.id).toBeGreaterThan(0)
      const directions = toLineDirections(await api.webGetRoutes(line.code))
      expect(directions.map((d) => d.type), line.id).toEqual(timetable.inbound.length > 0 ? ['1', '2'] : ['1'])
    }
  })

  it('reports bad parameters as {"error": ...} with status 200', async () => {
    const raw = await api.getDailySchedule('abc')
    expect(raw).toEqual({ error: 'invalid parameters' })
    expect(() => asList(raw as never)).toThrow(OasaApiError)
  })
})
