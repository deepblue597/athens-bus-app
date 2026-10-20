import { useQuery } from '@tanstack/react-query'
import { isOasaCode, oasaApi } from '../../data/oasa/client'
import { toBusLocations } from '../../data/oasa/adapters'

export const BUS_REFRESH_MS = 15_000

/**
 * Live positions of the buses on a route, polled while the page is visible (TanStack Query pauses
 * in background tabs). Never saved for offline use: an old position shown as live would mislead.
 */
export function useBusLocations(routeCode: string) {
  return useQuery({
    queryKey: ['busLocations', routeCode],
    queryFn: async () => toBusLocations(await oasaApi.getBusLocation(routeCode)),
    enabled: isOasaCode(routeCode),
    refetchInterval: BUS_REFRESH_MS,
    staleTime: 10_000,
  })
}
