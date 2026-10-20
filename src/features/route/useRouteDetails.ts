import { useQuery } from '@tanstack/react-query'
import { isOasaCode, oasaApi } from '../../data/oasa/client'
import { toRouteDetails } from '../../data/oasa/routeAdapters'

export function useRouteDetails(routeCode: string) {
  const isValidCode = isOasaCode(routeCode)
  // A route's path and stops rarely change
  const query = useQuery({
    queryKey: ['routeDetails', routeCode],
    queryFn: async () => toRouteDetails(routeCode, await oasaApi.webGetRoutesDetailsAndStops(routeCode)),
    enabled: isValidCode,
    staleTime: 24 * 60 * 60_000,
  })
  return { ...query, isValidCode, isPending: isValidCode && query.isPending }
}
