// When the News tab was last read, for the dot on the tab: the publish time of the newest
// announcement shown then. Kept on the device, like favourites.
const STORAGE_KEY = 'athens-bus:news-seen-until'

const listeners = new Set<() => void>()
let snapshot: number | null | undefined

function read(): number | null {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY))
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

/** Publish time (epoch ms) of the newest announcement seen, or null if News was never opened */
export function getNewsSeenUntil(): number | null {
  if (snapshot === undefined) {
    snapshot = read()
  }
  return snapshot
}

export function markNewsSeen(publishedAt: number) {
  const current = getNewsSeenUntil()
  if (current !== null && current >= publishedAt) {
    return
  }
  snapshot = publishedAt
  try {
    localStorage.setItem(STORAGE_KEY, String(publishedAt))
  } catch {
    // Still works for this session
  }
  listeners.forEach((notify) => notify())
}

export function subscribeNewsSeen(onChange: () => void): () => void {
  // Reading News in another tab clears the dot here too
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      snapshot = undefined
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
