import { useQuery } from '@tanstack/react-query'
import { fetchStationBoard } from '../../data/ose/board'

/** OSE's own screens refresh every 60 s and the Worker caches for 30 s */
export const BOARD_REFRESH_MS = 30_000

/** A Proastiakos station's live departures, polled while the page is visible. Never saved: it's live */
export function useStationBoard(board: number | null) {
  return useQuery({
    queryKey: ['stationBoard', board],
    queryFn: () => fetchStationBoard(board!),
    enabled: board !== null,
    refetchInterval: BOARD_REFRESH_MS,
    staleTime: 15_000,
  })
}
