import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

/** False when the device has no network connection (true can still mean OASA is unreachable) */
export function useOnline() {
  return useSyncExternalStore(subscribe, () => navigator.onLine)
}
