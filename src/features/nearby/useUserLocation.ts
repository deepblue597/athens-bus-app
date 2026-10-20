import { useCallback, useEffect, useState } from 'react'
import type { LatLng } from '../../domain/geo'

export type UserLocation =
  | { status: 'locating' }
  | { status: 'found'; position: LatLng }
  | { status: 'denied' }
  | { status: 'unavailable' }

const hasGeolocation = () => typeof navigator !== 'undefined' && 'geolocation' in navigator

export function useUserLocation() {
  const [location, setLocation] = useState<UserLocation>(() =>
    hasGeolocation() ? { status: 'locating' } : { status: 'unavailable' },
  )

  const requestPosition = useCallback(() => {
    if (!hasGeolocation()) {
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ status: 'found', position: { lat: pos.coords.latitude, lng: pos.coords.longitude } }),
      (err) => setLocation({ status: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable' }),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    )
  }, [])

  useEffect(requestPosition, [requestPosition])

  const locate = useCallback(() => {
    setLocation(hasGeolocation() ? { status: 'locating' } : { status: 'unavailable' })
    requestPosition()
  }, [requestPosition])

  return { location, locate }
}
