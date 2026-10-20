import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PersistedClient } from '@tanstack/react-query-persist-client'
import { createStoragePersister, type SavedQuery } from './queryPersister'

const HOUR = 60 * 60_000
const NOW = Date.parse('2026-10-20T12:00:00Z') // 15:00 in Athens

class MemoryStorage implements Storage {
  data = new Map<string, string>()
  writes = 0
  quota = Infinity
  get length() {
    return this.data.size
  }
  clear() {
    this.data.clear()
  }
  getItem(key: string) {
    return this.data.get(key) ?? null
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null
  }
  removeItem(key: string) {
    this.data.delete(key)
  }
  setItem(key: string, value: string) {
    if (value.length > this.quota) throw new DOMException('full', 'QuotaExceededError')
    this.writes++
    this.data.set(key, value)
  }
}

function query(key: unknown[], dataUpdatedAt: number, data: unknown = 'x', status: 'success' | 'error' = 'success'): SavedQuery {
  return {
    queryKey: key,
    queryHash: JSON.stringify(key),
    dehydratedAt: NOW,
    state: {
      data,
      dataUpdateCount: 1,
      dataUpdatedAt,
      error: status === 'error' ? new Error('OASA down') : null,
      errorUpdateCount: 0,
      errorUpdatedAt: 0,
      fetchFailureCount: status === 'error' ? 1 : 0,
      fetchFailureReason: null,
      fetchMeta: null,
      isInvalidated: false,
      status,
      fetchStatus: 'idle',
    },
  }
}

const client = (queries: SavedQuery[]): PersistedClient => ({
  buster: 'v1',
  timestamp: NOW,
  clientState: { mutations: [], queries },
})

const saved = (storage: MemoryStorage) => (JSON.parse(storage.getItem('k')!) as PersistedClient).clientState.queries

describe('createStoragePersister', () => {
  let storage: MemoryStorage
  const persister = (options: Partial<Parameters<typeof createStoragePersister>[0]> = {}) =>
    createStoragePersister({ storage, key: 'k', maxAgeMs: 24 * HOUR, maxChars: 100_000, ...options })

  beforeEach(() => {
    storage = new MemoryStorage()
    vi.useFakeTimers({ now: NOW })
  })
  afterEach(() => vi.useRealTimers())

  it('writes at most once per second, and not at all when no saved query changed', async () => {
    const p = persister()
    const lines = query(['lines'], NOW - HOUR)
    await p.persistClient(client([lines]))
    await p.persistClient(client([lines]))
    expect(storage.writes).toBe(0)
    vi.advanceTimersByTime(1000)
    expect(storage.writes).toBe(1)

    // e.g. an arrivals poll: the cache changed, the saved queries didn't
    await p.persistClient(client([lines]))
    vi.advanceTimersByTime(1000)
    expect(storage.writes).toBe(1)

    await p.persistClient(client([lines, query(['timetable', '938', 'today'], NOW)]))
    vi.advanceTimersByTime(1000)
    expect(storage.writes).toBe(2)
  })

  it('drops queries fetched more than a day ago', async () => {
    const p = persister()
    await p.persistClient(client([query(['lines'], NOW - 25 * HOUR), query(['routeDetails', '2051'], NOW - 23 * HOUR)]))
    vi.advanceTimersByTime(1000)
    expect(saved(storage).map((q) => q.queryKey[0])).toEqual(['routeDetails'])

    vi.setSystemTime(NOW + 2 * HOUR)
    expect((await p.restoreClient())?.clientState.queries).toEqual([])
  })

  it('keeps the newest queries within the size limit', async () => {
    const p = persister({ maxChars: 2200 })
    const big = 'x'.repeat(600)
    await p.persistClient(
      client([query(['routeDetails', '1'], NOW - 3 * HOUR, big), query(['routeDetails', '2'], NOW - HOUR, big), query(['routeDetails', '3'], NOW - 2 * HOUR, big)]),
    )
    vi.advanceTimersByTime(1000)
    expect(saved(storage).map((q) => q.queryKey[1])).toEqual(['2', '3'])
  })

  it('removes the saved copy when storage is full, so favourites can still be saved', async () => {
    storage.setItem('k', 'old')
    storage.quota = 10
    const p = persister()
    await p.persistClient(client([query(['lines'], NOW)]))
    vi.advanceTimersByTime(1000)
    expect(storage.getItem('k')).toBeNull()
  })

  it('saves data whose refresh failed as data, not as an error', async () => {
    const p = persister()
    await p.persistClient(client([query(['timetable', '938', '54'], NOW - HOUR, 'times', 'error')]))
    vi.advanceTimersByTime(1000)
    expect(saved(storage)[0].state).toMatchObject({ status: 'success', data: 'times', error: null })
  })

  it('restores nothing from broken or blocked storage', async () => {
    storage.setItem('k', '{not json')
    expect(await persister().restoreClient()).toBeUndefined()
    expect(await createStoragePersister({ storage: undefined, key: 'k', maxAgeMs: HOUR, maxChars: 10 }).restoreClient()).toBeUndefined()
  })

  it('doesn’t restore queries the app marks as outdated', async () => {
    const p = persister({ isOutdated: (q) => q.queryKey[2] === 'today' })
    await p.persistClient(client([query(['timetable', '938', 'today'], NOW), query(['timetable', '938', '54'], NOW)]))
    vi.advanceTimersByTime(1000)
    expect((await p.restoreClient())?.clientState.queries.map((q) => q.queryKey)).toEqual([['timetable', '938', '54']])
  })
})
