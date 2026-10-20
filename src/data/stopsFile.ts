import { distanceInMeters, type LatLng } from '../domain/geo'
import type { StopsFile } from '../domain/stopsFile'
import type { MapStop, NearbyStop } from '../domain/types'

export async function fetchAllStops(): Promise<MapStop[]> {
  const res = await fetch('/data/stops.json')
  if (!res.ok) {
    throw new Error(`Couldn’t load the stops file (${res.status})`)
  }
  return fromStopsFile((await res.json()) as StopsFile)
}

export function fromStopsFile(file: StopsFile): MapStop[] {
  return file.stops.map(([code, displayId, name, nameEn, lat, lng, lines]) => ({
    code,
    displayId,
    name,
    nameEn,
    street: null,
    lat,
    lng,
    lines,
  }))
}

/** Closest stops from the stops file, for when the API can't be reached */
export function nearestStops(stops: MapStop[], origin: LatLng, maxMeters: number, limit = 20): NearbyStop[] {
  return stops
    .map((s) => ({ ...s, distanceMeters: Math.round(distanceInMeters(origin, s)) }))
    .filter((s) => s.distanceMeters <= maxMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, limit)
}
