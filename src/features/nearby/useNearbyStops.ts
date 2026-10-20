import { useQuery } from '@tanstack/react-query'
import { oasaApi } from '../../data/oasa/client'
import { toNearbyStops } from '../../data/oasa/adapters'
import type { LatLng } from '../../domain/geo'

/** Stops further than this are not "nearby" (and far from Athens the API returns test stops) */
export const MAX_NEARBY_METERS = 1500

// ~10 m precision, so small GPS jitter reuses the cached result
const round = (n: number) => Math.round(n * 10_000) / 10_000

export function useNearbyStops(point: LatLng | null) {
  return useQuery({
    queryKey: ['nearbyStops', point && round(point.lat), point && round(point.lng)],
    queryFn: async () => {
      const origin = point!
      const raw = await oasaApi.getClosestStops(String(origin.lat), String(origin.lng))
      return toNearbyStops(raw, origin, MAX_NEARBY_METERS)
    },
    enabled: point !== null,
    staleTime: 5 * 60_000,
  })
}
