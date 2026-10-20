import { useQuery, useQueryClient } from '@tanstack/react-query'
import { oasaApi } from '../../data/oasa/client'
import { toNearbyStops } from '../../data/oasa/adapters'
import { fetchAllStops, nearestStops } from '../../data/stopsFile'
import type { LatLng } from '../../domain/geo'
import type { NearbyStop } from '../../domain/types'
import { ALL_STOPS_KEY } from '../map/useAllStops'

/** Stops further than this are not "nearby" (and far from Athens the API returns test stops) */
export const MAX_NEARBY_METERS = 1500

// ~10 m precision, so small GPS jitter reuses the cached result
const round = (n: number) => Math.round(n * 10_000) / 10_000

export interface NearbyResult {
  stops: NearbyStop[]
  /** True when OASA couldn't be reached and the stops came from the nightly stops file */
  fromFile: boolean
}

export function useNearbyStops(point: LatLng | null) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: ['nearbyStops', point && round(point.lat), point && round(point.lng)],
    queryFn: async (): Promise<NearbyResult> => {
      const origin = point!
      try {
        const raw = await oasaApi.getClosestStops(String(origin.lat), String(origin.lng))
        return { stops: toNearbyStops(raw, origin, MAX_NEARBY_METERS), fromFile: false }
      } catch (err) {
        // Offline or OASA down: the stops file is cached by the service worker
        const all = await queryClient.ensureQueryData({ queryKey: ALL_STOPS_KEY, queryFn: fetchAllStops }).catch(() => null)
        if (!all) {
          throw err
        }
        return { stops: nearestStops(all, origin, MAX_NEARBY_METERS), fromFile: true }
      }
    },
    enabled: point !== null,
    staleTime: 5 * 60_000,
    // Run even when offline, so the stops file fallback above is used instead of waiting
    networkMode: 'offlineFirst',
  })
}
