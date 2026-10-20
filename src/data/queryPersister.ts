import type { DehydratedState } from '@tanstack/react-query'
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client'

export type SavedQuery = DehydratedState['queries'][number]

/**
 * Data whose refresh failed (OASA down) is saved as plain data, so it comes back as data to show
 * rather than as an error.
 */
function asSuccess(query: SavedQuery): SavedQuery {
  if (query.state.status !== 'error') return query
  return {
    ...query,
    state: { ...query.state, status: 'success', error: null, fetchFailureCount: 0, fetchFailureReason: null },
  }
}

export interface StoragePersisterOptions {
  storage: Storage | undefined
  key: string
  /** Queries whose data is older than this are not saved or restored */
  maxAgeMs: number
  /** The newest queries are kept up to this many characters, leaving room for favourites */
  maxChars: number
  /** Queries that must not be restored even though they are recent */
  isOutdated?: (query: SavedQuery, now: number) => boolean
  throttleMs?: number
}

/**
 * Saves TanStack Query's cache in localStorage. Unlike createSyncStoragePersister it:
 * - skips the write when no saved query changed (live arrivals update the cache every 20 s, which
 *   would otherwise rewrite hundreds of KB each time),
 * - keeps queries only for `maxAgeMs` after they were fetched (hydrated queries get a fresh gcTime,
 *   so without this a route opened once would be saved forever by someone who opens the app daily),
 * - caps the size, dropping the oldest queries first, so it can't use up the ~5 MB quota that
 *   favourites share,
 * - writes pending changes when the page is hidden (the app is closed or switched away from).
 */
export function createStoragePersister({
  storage,
  key,
  maxAgeMs,
  maxChars,
  isOutdated = () => false,
  throttleMs = 1000,
}: StoragePersisterOptions): Persister {
  let savedSignature = ''
  let pending: PersistedClient | null = null
  let timer: ReturnType<typeof setTimeout> | undefined

  const keep = (queries: SavedQuery[], now: number) =>
    queries.filter((q) => now - q.state.dataUpdatedAt <= maxAgeMs && !isOutdated(q, now))
  const signatureOf = (queries: SavedQuery[]) => queries.map((q) => `${q.queryHash}@${q.state.dataUpdatedAt}`).join('|')

  const write = () => {
    clearTimeout(timer)
    timer = undefined
    const client = pending
    pending = null
    if (!client || !storage) return
    const queries = keep(client.clientState.queries, Date.now())
    const signature = signatureOf(queries)
    if (signature === savedSignature) return

    const kept: SavedQuery[] = []
    let size = 0
    for (const query of [...queries].sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt)) {
      const querySize = JSON.stringify(query).length
      if (size + querySize <= maxChars) {
        kept.push(query)
        size += querySize
      }
    }
    try {
      storage.setItem(key, JSON.stringify({ ...client, clientState: { mutations: [], queries: kept.map(asSuccess) } }))
      savedSignature = signature
    } catch {
      // Quota exceeded or storage blocked: drop the saved copy rather than keep a stale one
      try {
        storage.removeItem(key)
      } catch {
        // Nothing more to do
      }
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && write())
    window.addEventListener('pagehide', write)
  }

  return {
    persistClient(client) {
      pending = client
      timer ??= setTimeout(write, throttleMs)
    },
    restoreClient() {
      try {
        const raw = storage?.getItem(key)
        if (!raw) return undefined
        const client = JSON.parse(raw) as PersistedClient
        const queries = keep(client.clientState.queries, Date.now())
        // What is stored now, so the first save rewrites it only if queries were dropped here
        savedSignature = signatureOf(client.clientState.queries)
        return { ...client, clientState: { ...client.clientState, queries } }
      } catch {
        return undefined
      }
    },
    removeClient() {
      savedSignature = ''
      try {
        storage?.removeItem(key)
      } catch {
        // Storage blocked
      }
    },
  }
}
