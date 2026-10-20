import type { Stop } from '../domain/types'

// Favourite stops live in this browser only (no accounts, see docs/architecture.md)
const STORAGE_KEY = 'athens-bus:favourite-stops'

export type FavouriteStop = Pick<Stop, 'code' | 'displayId' | 'name' | 'nameEn' | 'lat' | 'lng'>

const listeners = new Set<() => void>()
let snapshot: FavouriteStop[] | null = null

function read(): FavouriteStop[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    // Entries without a code would break the list (and toggling), so they are left out
    return Array.isArray(parsed) ? (parsed as FavouriteStop[]).filter((s) => typeof s?.code === 'string') : []
  } catch {
    // Private browsing or blocked storage: behave as if there are no favourites
    return []
  }
}

function write(stops: FavouriteStop[]) {
  snapshot = stops
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stops))
  } catch {
    // Still works for this session
  }
  listeners.forEach((notify) => notify())
}

/** The same array until favourites change, as useSyncExternalStore requires */
export function getFavourites(): FavouriteStop[] {
  snapshot ??= read()
  return snapshot
}

export function subscribeFavourites(onChange: () => void): () => void {
  // Keeps other tabs in sync
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      snapshot = null
      onChange()
    }
  }
  listeners.add(onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener('storage', onStorage)
  }
}

export function toggleFavourite(stop: Stop) {
  const current = getFavourites()
  write(
    current.some((s) => s.code === stop.code)
      ? current.filter((s) => s.code !== stop.code)
      : [
          ...current,
          { code: stop.code, displayId: stop.displayId, name: stop.name, nameEn: stop.nameEn, lat: stop.lat, lng: stop.lng },
        ],
  )
}
