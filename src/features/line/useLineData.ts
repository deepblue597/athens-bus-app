import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { isOasaCode, oasaApi } from '../../data/oasa/client'
import { toLineDirections, toLines, toScheduleDays, toTimetable } from '../../data/oasa/lineAdapters'
import type { Line } from '../../domain/line'
import { athensMinutesNow } from '../../domain/time'

const DAY_MS = 24 * 60 * 60_000

/** "today" is the day's actual plan (getDailySchedule); other values are schedule day codes */
export const TODAY = 'today'

/** All lines (~180 KB), cached for a day */
export function useLines() {
  return useQuery({
    queryKey: ['lines'],
    queryFn: async () => toLines(await oasaApi.webGetLinesWithMLInfo()),
    staleTime: DAY_MS,
  })
}

export function useLineDirections(lineCode: string) {
  return useQuery({
    queryKey: ['lineDirections', lineCode],
    queryFn: async () => toLineDirections(await oasaApi.webGetRoutes(lineCode)),
    enabled: isOasaCode(lineCode),
    staleTime: DAY_MS,
  })
}

export function useScheduleDays(lineCode: string) {
  return useQuery({
    queryKey: ['scheduleDays', lineCode],
    queryFn: async () => toScheduleDays(await oasaApi.getScheduleDaysMasterline(lineCode)),
    enabled: isOasaCode(lineCode),
    staleTime: DAY_MS,
  })
}

export function useTimetable(line: Line | undefined, day: string) {
  return useQuery({
    queryKey: ['timetable', line?.code, day],
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
