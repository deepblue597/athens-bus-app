import { useQuery } from '@tanstack/react-query'
import { ROUTES_STALE_MS } from '../../app/queryClient'
import { isOasaCode, oasaApi } from '../../data/oasa/client'
import { toRouteDetails } from '../../data/oasa/routeAdapters'

export function useRouteDetails(routeCode: string) {
  const isValidCode = isOasaCode(routeCode)
  const query = useQuery({
    queryKey: ['routeDetails', routeCode],
    queryFn: async () => toRouteDetails(routeCode, await oasaApi.webGetRoutesDetailsAndStops(routeCode)),
    enabled: isValidCode,
    staleTime: ROUTES_STALE_MS,
  })
  return { ...query, isValidCode, isPending: isValidCode && query.isPending }
}
