import { useQuery } from '@tanstack/react-query'
import { ROUTES_STALE_MS } from '../../app/queryClient'
import { fetchAllStops } from '../../data/stopsFile'

export const ALL_STOPS_KEY = ['allStops']

/** Every stop, from the nightly stops file (~200 KB gzipped); changes at most once a day */
export function useAllStops(enabled = true) {
  return useQuery({
    queryKey: ALL_STOPS_KEY,
    queryFn: fetchAllStops,
    enabled,
    staleTime: ROUTES_STALE_MS,
    // Fetch even when offline: the service worker has a copy
    networkMode: 'offlineFirst',
  })
}
