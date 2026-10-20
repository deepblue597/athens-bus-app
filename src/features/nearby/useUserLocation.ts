import { useCallback, useEffect, useState } from 'react'
import { distanceInMeters, type LatLng } from '../../domain/geo'

export type UserLocation =
  | { status: 'locating' }
  | { status: 'found'; position: LatLng }
  | { status: 'denied' }
  | { status: 'unavailable' }

const hasGeolocation = () => typeof navigator !== 'undefined' && 'geolocation' in navigator

/** A GPS fix closer than this to the quick position doesn't move the map or reload the stops */
const REFINE_MIN_METERS = 75

const toLatLng = (pos: GeolocationPosition): LatLng => ({ lat: pos.coords.latitude, lng: pos.coords.longitude })

export function useUserLocation() {
  const [location, setLocation] = useState<UserLocation>(() =>
    hasGeolocation() ? { status: 'locating' } : { status: 'unavailable' },
  )

  /**
   * Asks twice at once: a quick position (recent or network-based, usually instant) so stops show
   * right away, and a precise GPS fix, which can take several seconds when GPS is cold and replaces
   * the quick one if it is noticeably different.
   */
  const requestPosition = useCallback(() => {
    if (!hasGeolocation()) {
      return
    }
    let found: LatLng | null = null
    let precise = false

    const onQuick = (pos: GeolocationPosition) => {
      if (!precise) {
        found = toLatLng(pos)
        setLocation({ status: 'found', position: found })
      }
    }
    const onPrecise = (pos: GeolocationPosition) => {
      precise = true
      const position = toLatLng(pos)
      if (!found || distanceInMeters(found, position) > REFINE_MIN_METERS) {
        found = position
        setLocation({ status: 'found', position })
      }
    }
    const onError = (err: GeolocationPositionError) => {
      if (err.code === err.PERMISSION_DENIED) {
        setLocation({ status: 'denied' })
      } else if (!found) {
        setLocation({ status: 'unavailable' })
      }
    }

    navigator.geolocation.getCurrentPosition(onQuick, (err) => err.code === err.PERMISSION_DENIED && onError(err), {
      enableHighAccuracy: false,
      maximumAge: 10 * 60_000,
      timeout: 5000,
    })
    navigator.geolocation.getCurrentPosition(onPrecise, onError, {
      enableHighAccuracy: true,
      maximumAge: 60_000,
      timeout: 15_000,
    })
  }, [])

  useEffect(requestPosition, [requestPosition])

  const locate = useCallback(() => {
    setLocation(hasGeolocation() ? { status: 'locating' } : { status: 'unavailable' })
    requestPosition()
  }, [requestPosition])

  return { location, locate }
}
