// Anti-corruption layer: turns raw OASA responses (numbers as strings, 1900-01-01 dates,
// mixed field names) into the app's domain types.
import type { IArrival, IClosestStop, IStop } from 'oasa-telematics-api'
import type { Arrival, NearbyStop, ScheduleTime, Stop } from '../../domain/types'

const EARTH_RADIUS_METERS = 6_371_000

export interface LatLng {
  lat: number
  lng: number
}

export function toStop(raw: IStop | IClosestStop): Stop {
  return {
    code: raw.StopCode,
    displayId: raw.StopID,
    name: raw.StopDescr,
    nameEn: raw.StopDescrEng,
    street: raw.StopStreet,
    lat: Number(raw.StopLat),
    lng: Number(raw.StopLng),
  }
}

// The API's own `distance` field is in degrees, so compute metres from the origin instead
export function toNearbyStop(raw: IClosestStop, origin: LatLng): NearbyStop {
  const stop = toStop(raw)
  return { ...stop, distanceMeters: Math.round(distanceInMeters(origin, stop)) }
}

/** Haversine distance between two points */
export function distanceInMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h))
}

export function toArrival(raw: IArrival): Arrival {
  return {
    routeCode: raw.route_code,
    vehicleCode: raw.veh_code,
    minutes: Number(raw.btime2),
  }
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
