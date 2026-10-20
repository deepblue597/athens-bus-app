import type { IRouteDetailsAndStops } from 'oasa-telematics-api'
import type { RouteDetails } from '../../domain/route'
import { toStop } from './adapters'

/** Unknown routes come back as empty lists; sorting guards against the API changing its order */
export function toRouteDetails(routeCode: string, raw: IRouteDetailsAndStops | null): RouteDetails {
  const path = [...(raw?.details ?? [])]
    .sort((a, b) => Number(a.routed_order) - Number(b.routed_order))
    // routed_x is the longitude and routed_y the latitude
    .map((p) => ({ lat: Number(p.routed_y), lng: Number(p.routed_x) }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))

  const stops = [...(raw?.stops ?? [])]
    .sort((a, b) => Number(a.RouteStopOrder) - Number(b.RouteStopOrder))
    .map((s) => ({ ...toStop(s), order: Number(s.RouteStopOrder) }))

  return { routeCode, path, stops }
}
