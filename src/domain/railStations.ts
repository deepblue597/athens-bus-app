import { distanceInMeters, type LatLng } from './geo'
import type { MetroNetwork, MetroStation } from './metro'

export interface NearbyStation {
  station: MetroStation
  metres: number
}

/** Metro, tram and Proastiakos stations within `maxMetres` of a point, closest first */
export function stationsNear(network: MetroNetwork, point: LatLng, maxMetres: number, limit: number): NearbyStation[] {
  return network.stations
    .map((station) => ({ station, metres: distanceInMeters(point, station) }))
    .filter((n) => n.metres <= maxMetres)
    .sort((a, b) => a.metres - b.metres)
    .slice(0, limit)
}
