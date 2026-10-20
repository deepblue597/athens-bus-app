// The app's own data model. Nothing outside src/data knows about the raw OASA format.

export interface Stop {
  /** OASA StopCode (GTFS stop_id), used in every API call */
  code: string
  /** Number shown on the stop sign (OASA StopID, GTFS stop_code) */
  displayId: string
  name: string
  nameEn: string
  street: string | null
  lat: number
  lng: number
}

export interface NearbyStop extends Stop {
  /** Approximate distance from the requested point, in metres */
  distanceMeters: number
}

export interface Arrival {
  routeCode: string
  vehicleCode: string
  minutes: number
}

export interface ScheduleTime {
  /** "HH:mm" as printed on timetables */
  label: string
  /** Minutes since midnight of the service day; after-midnight trips are > 1440 */
  minutesOfServiceDay: number
}
