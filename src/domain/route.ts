import type { LatLng } from './geo'
import type { Stop } from './types'

export interface RouteStop extends Stop {
  /** Position of the stop along the route, starting at 1 */
  order: number
}

/** The path and stops of one route (one direction of a line) */
export interface RouteDetails {
  routeCode: string
  /** Points of the route's path in driving order */
  path: LatLng[]
  stops: RouteStop[]
}
