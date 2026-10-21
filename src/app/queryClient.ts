import { QueryClient, type Query } from '@tanstack/react-query'
import { createStoragePersister, type SavedQuery } from '../data/queryPersister'
import { athensDate } from '../domain/time'

const DAY_MS = 24 * 60 * 60_000

/** Lines, routes and stops are refetched after this, so detours and route changes show up within hours */
export const ROUTES_STALE_MS = 12 * 60 * 60_000

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // The OASA client already retries once
      retry: false,
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      // Kept for a day so the persister below can save them (it drops queries that are gone)
      gcTime: DAY_MS,
      // Run offline too instead of pausing: queries then fail, or fall back to saved data, rather than
      // leaving pages on "Loading…" until the connection returns
      networkMode: 'offlineFirst',
    },
  },
})

/**
 * Data saved on the device so it's there offline and on the next visit. Live data (arrivals,
 * nearby stops) is never saved, and the stops file is cached by the service worker instead.
 */
const PERSISTED_QUERIES = new Set([
  'lines',
  'lineDirections',
  'scheduleDays',
  'timetable',
  'routeDetails',
  'stopRoutes',
  // The News list, so it shows offline and when oasa.gr is down (single announcements come from it)
  'announcements',
])

/**
 * The "Today" timetable (key ['timetable', lineCode, 'today', ...]) is that day's plan: after
 * midnight yesterday's copy would give wrong next departures, so it isn't restored then.
 */
export function isOutdatedQuery(query: SavedQuery, now: number): boolean {
  const [type, , day] = query.queryKey
  return type === 'timetable' && day === 'today' && athensDate(query.state.dataUpdatedAt) !== athensDate(now)
}

export const persistOptions = {
  persister: createStoragePersister({
    storage: safeLocalStorage(),
    key: 'athens-bus:query-cache',
    maxAgeMs: DAY_MS,
    // ~2 MB of UTF-16; 20 lines with their timetables and routes take ~450,000
    maxChars: 1_000_000,
    isOutdated: isOutdatedQuery,
  }),
  maxAge: DAY_MS,
  // Bump when the shape of saved data changes, to drop old saved copies
  buster: 'v1',
  dehydrateOptions: {
    // Data that failed to refresh (OASA down) is still worth keeping
    shouldDehydrateQuery: (query: Query) =>
      query.state.data !== undefined && PERSISTED_QUERIES.has(String(query.queryKey[0])),
  },
}

function safeLocalStorage(): Storage | undefined {
  try {
    return window.localStorage
  } catch {
    // Storage blocked: nothing is saved, everything else works
    return undefined
  }
}
