import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ROUTES_STALE_MS } from '../../app/queryClient'
import { isOasaCode, oasaApi } from '../../data/oasa/client'
import { toLineDirections, toLines, toScheduleDays, toTimetable } from '../../data/oasa/lineAdapters'
import type { Line } from '../../domain/line'
import { athensDate, athensMinutesNow } from '../../domain/time'

/** "today" is the day's actual plan (getDailySchedule); other values are schedule day codes */
export const TODAY = 'today'

/** All lines (~180 KB) */
export function useLines() {
  return useQuery({
    queryKey: ['lines'],
    queryFn: async () => toLines(await oasaApi.webGetLinesWithMLInfo()),
    staleTime: ROUTES_STALE_MS,
  })
}

export function useLineDirections(lineCode: string) {
  return useQuery({
    queryKey: ['lineDirections', lineCode],
    queryFn: async () => toLineDirections(await oasaApi.webGetRoutes(lineCode)),
    enabled: isOasaCode(lineCode),
    staleTime: ROUTES_STALE_MS,
  })
}

export function useScheduleDays(lineCode: string) {
  return useQuery({
    queryKey: ['scheduleDays', lineCode],
    queryFn: async () => toScheduleDays(await oasaApi.getScheduleDaysMasterline(lineCode)),
    enabled: isOasaCode(lineCode),
    staleTime: ROUTES_STALE_MS,
  })
}

export function useTimetable(line: Line | undefined, day: string) {
  return useQuery({
    // Today's plan changes at midnight; LinePage re-renders every 30 s, so the key moves on by itself.
    // 'today' must stay the third element: isOutdatedQuery in app/queryClient.ts relies on it
    queryKey: ['timetable', line?.code, day, day === TODAY ? athensDate() : null],
    queryFn: async () =>
      toTimetable(
        day === TODAY
          ? await oasaApi.getDailySchedule(line!.code)
          : await oasaApi.getSchedLines(line!.masterCode, day, line!.code),
      ),
    enabled: line !== undefined,
    staleTime: 60 * 60_000,
  })
}

/** Minutes since midnight in Athens, updated every 30 s */
export function useAthensMinutes() {
  const [minutes, setMinutes] = useState(() => athensMinutesNow())
  useEffect(() => {
    const id = setInterval(() => setMinutes(athensMinutesNow()), 30_000)
    return () => clearInterval(id)
  }, [])
  return minutes
}
