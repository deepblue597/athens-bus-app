import type { Arrival, Stop, StopRoute } from '../../domain/types'
import type { RoutePageState } from '../route/RoutePage'

/**
 * What the route page needs to show the line, highlight the stop the user came from and, when
 * opened from an arrival, the bus that is coming
 */
export function routeState(
  route: StopRoute | null,
  stopCode: string,
  stop: Stop | undefined,
  arrival?: Arrival,
): RoutePageState {
  return {
    route: route ?? undefined,
    fromStopCode: stopCode,
    fromStop: stop,
    trackedBus: arrival && { vehicleCode: arrival.vehicleCode, minutes: arrival.minutes },
  }
}
