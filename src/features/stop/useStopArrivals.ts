import { useQuery } from '@tanstack/react-query'
import { ROUTES_STALE_MS } from '../../app/queryClient'
import { isOasaCode, oasaApi } from '../../data/oasa/client'
import { toArrivals, toStopRoutes, withRoutes } from '../../data/oasa/adapters'

export const ARRIVALS_REFRESH_MS = 20_000

export function useStopArrivals(stopCode: string) {
  const isValidCode = isOasaCode(stopCode)

  // Live estimates: polled while the page is visible (TanStack Query pauses in background tabs)
  const arrivals = useQuery({
    queryKey: ['arrivals', stopCode],
    queryFn: async () => toArrivals(await oasaApi.getStopArrivals(stopCode)),
    enabled: isValidCode,
    refetchInterval: ARRIVALS_REFRESH_MS,
    staleTime: 10_000,
  })

  const routes = useQuery({
    queryKey: ['stopRoutes', stopCode],
    queryFn: async () => toStopRoutes(await oasaApi.webRoutesForStop(stopCode)),
    enabled: isValidCode,
    staleTime: ROUTES_STALE_MS,
  })

  return {
    isValidCode,
    arrivals: arrivals.data ? withRoutes(arrivals.data, routes.data ?? []) : undefined,
    routes: routes.data,
    isLoading: isValidCode && arrivals.isPending,
    isError: arrivals.isError,
    isFetching: arrivals.isFetching,
    /** Offline: TanStack Query waits for the connection instead of fetching */
    isPaused: arrivals.isPaused,
    updatedAt: arrivals.dataUpdatedAt,
    refetch: arrivals.refetch,
  }
}
