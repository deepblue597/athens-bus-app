// The app's own data model. Nothing outside src/data knows about the raw OASA format.

export interface Stop {
  /** OASA StopCode (GTFS stop_id), used in every API call */
  code: string
  /** Number shown on the stop sign (OASA StopID, GTFS stop_code) */
  displayId: string
  name: string
  nameEn: string | null
  street: string | null
  lat: number
  lng: number
}

/** A stop from the nightly stops file (public/data/stops.json) */
export interface MapStop extends Stop {
  /** Line numbers serving the stop, e.g. ["040", "Β1"] */
  lines: string[]
}

export interface NearbyStop extends Stop {
  /** Distance from the requested point, in metres */
  distanceMeters: number
}

/** A route (one direction of a line) that serves a stop */
export interface StopRoute {
  routeCode: string
  lineCode: string
  /** Line number shown on the bus, e.g. "Β1" or "040" */
  lineId: string
  lineName: string
  routeName: string
  routeNameEn: string | null
}

/** A bus's last reported position on a route */
export interface BusLocation {
  vehicleCode: string
  lat: number
  lng: number
  /** Degrees clockwise from north, when reported */
  heading: number | null
  /** When the bus reported this position (epoch ms), when the date could be read */
  reportedAt: number | null
}

export interface Arrival {
  routeCode: string
  vehicleCode: string
  minutes: number
}

export interface LineArrival extends Arrival {
  /** null when the API reports a route that is not in the stop's route list */
  route: StopRoute | null
}

export interface ScheduleTime {
  /** "HH:mm" as printed on timetables */
  label: string
  /** Minutes since midnight of the service day; after-midnight trips are > 1440 */
  minutesOfServiceDay: number
}
