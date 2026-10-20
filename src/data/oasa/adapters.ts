// Anti-corruption layer: turns raw OASA responses (numbers as strings, 1900-01-01 dates,
// mixed field names, nulls where the types promise strings) into the app's domain types.
import type { IArrival, IClosestStop, IRouteOfStop, IStop } from 'oasa-telematics-api'
import { distanceInMeters, type LatLng } from '../../domain/geo'
import type { Arrival, LineArrival, NearbyStop, ScheduleTime, Stop, StopRoute } from '../../domain/types'

/** OASA answers bad requests with HTTP 200 and a body like {"error":"invalid parameters"} */
export class OasaApiError extends Error {
  name = 'OasaApiError'
}

/**
 * Normalises a list response. "Nothing found" is null on most endpoints but "" on getBusLocation,
 * and errors arrive as {"error": "..."} with status 200, so neither `?? []` nor res.ok catches them.
 */
export function asList<T>(raw: T[] | null | undefined): T[] {
  if (Array.isArray(raw)) {
    return raw
  }
  if (raw === null || raw === undefined || (raw as unknown) === '') {
    return []
  }
  const error = (raw as { error?: unknown }).error
  throw new OasaApiError(typeof error === 'string' ? `OASA: ${error}` : `Unexpected OASA response: ${JSON.stringify(raw).slice(0, 100)}`)
}

export function toStop(raw: IStop | IClosestStop): Stop {
  return {
    code: raw.StopCode,
    displayId: raw.StopID,
    name: raw.StopDescr,
    nameEn: raw.StopDescrEng || null,
    street: raw.StopStreet || null,
    lat: Number(raw.StopLat),
    lng: Number(raw.StopLng),
  }
}

// The API's own `distance` field is in degrees, so compute metres from the origin instead
export function toNearbyStop(raw: IClosestStop, origin: LatLng): NearbyStop {
  const stop = toStop(raw)
  return { ...stop, distanceMeters: Math.round(distanceInMeters(origin, stop)) }
}

/** getClosestStops always returns this many stops, however far away they are */
export const CLOSEST_STOPS_LIMIT = 20

/**
 * Nearby stops within `maxMeters`, closest first.
 *
 * getClosestStops ranks stops by flat lat/lng degrees, which overstates east-west distances (a degree
 * of longitude is ~21% shorter than one of latitude in Athens), and cuts off at 20. So in dense areas
 * the last few stops it returns can be further away than stops it left out (seen at Syntagma, Piraeus,
 * Kifisia and Peristeri). Only the radius in which no stop can have been left out is kept.
 */
export function toNearbyStops(raw: IClosestStop[] | null, origin: LatLng, maxMeters: number): NearbyStop[] {
  const rows = asList(raw)
  let radius = maxMeters
  if (rows.length >= CLOSEST_STOPS_LIMIT) {
    const furthestDegrees = Math.max(
      ...rows.map((s) => Math.hypot(Number(s.StopLat) - origin.lat, Number(s.StopLng) - origin.lng)).filter(Number.isFinite),
    )
    // A stop the API left out is at least this many degrees away, and a degree is shortest east-west
    radius = Math.min(radius, distanceInMeters(origin, { lat: origin.lat, lng: origin.lng + furthestDegrees }))
  }
  return rows
    .map((s) => toNearbyStop(s, origin))
    .filter((s) => s.distanceMeters <= radius)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
}

/**
 * The API lists a route once per master line it belongs to; keep one entry per route.
 * Routes flagged hidden (detours and seasonal variants such as "20*", "*** ...") are left out.
 */
export function toStopRoutes(raw: IRouteOfStop[] | null): StopRoute[] {
  const seen = new Set<string>()
  const routes: StopRoute[] = []
  for (const r of asList(raw)) {
    if (r.hidden === '1' || seen.has(r.RouteCode)) {
      continue
    }
    seen.add(r.RouteCode)
    routes.push({
      routeCode: r.RouteCode,
      lineCode: r.LineCode,
      lineId: r.LineID.trim(),
      lineName: r.LineDescr,
      routeName: r.RouteDescr,
      routeNameEn: r.RouteDescrEng || null,
    })
  }
  return routes
}

/**
 * The API returns null instead of an empty list when no bus is due, and at some stops (e.g. 10272)
 * lists every bus twice; keep the soonest estimate per route and vehicle.
 */
export function toArrivals(raw: IArrival[] | null): Arrival[] {
  const byVehicle = new Map<string, Arrival>()
  for (const a of asList(raw)) {
    const minutes = Number.parseInt(a.btime2, 10)
    if (Number.isNaN(minutes)) {
      continue
    }
    const key = `${a.route_code}-${a.veh_code}`
    const seen = byVehicle.get(key)
    if (!seen || minutes < seen.minutes) {
      byVehicle.set(key, { routeCode: a.route_code, vehicleCode: a.veh_code, minutes })
    }
  }
  return [...byVehicle.values()]
}

/** Attaches line details to each arrival, soonest first */
export function withRoutes(arrivals: Arrival[], routes: StopRoute[]): LineArrival[] {
  const byCode = new Map(routes.map((r) => [r.routeCode, r]))
  return arrivals
    .map((a) => ({ ...a, route: byCode.get(a.routeCode) ?? null }))
    .sort((a, b) => a.minutes - b.minutes)
}

/** Parses OASA timetable times such as "1900-01-01 05:10:00" or "1900-01-02 00:30:00" */
export function parseScheduleTime(raw: string | null): ScheduleTime | null {
  const match = raw?.match(/^1900-01-(\d{2}) (\d{2}):(\d{2})/)
  if (!match) {
    return null
  }
  const [, day, hours, minutes] = match
  const dayOffset = (Number(day) - 1) * 24 * 60
  return {
    label: `${hours}:${minutes}`,
    minutesOfServiceDay: dayOffset + Number(hours) * 60 + Number(minutes),
  }
}
