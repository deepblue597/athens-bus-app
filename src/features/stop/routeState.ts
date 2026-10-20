import type { Stop, StopRoute } from '../../domain/types'
import type { RoutePageState } from '../route/RoutePage'

/** What the route page needs to show the line and highlight the stop the user came from */
export function routeState(route: StopRoute | null, stopCode: string, stop: Stop | undefined): RoutePageState {
  return { route: route ?? undefined, fromStopCode: stopCode, fromStop: stop }
}
