import { useQuery } from '@tanstack/react-query'
import { ROUTES_STALE_MS } from '../../app/queryClient'
import { fetchMetroNetwork } from '../../data/metroFile'

/** The metro lines and STASY's timetable (~40 KB gzipped), rebuilt nightly */
export function useMetroNetwork() {
  return useQuery({
    queryKey: ['metroNetwork'],
    queryFn: fetchMetroNetwork,
    staleTime: ROUTES_STALE_MS,
    // Fetch even when offline: the service worker (or the Android app's bundle) has a copy
    networkMode: 'offlineFirst',
  })
}
