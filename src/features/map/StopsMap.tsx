import { useEffect, useRef } from 'react'
import Map, { Marker, NavigationControl, type MapRef } from 'react-map-gl/maplibre'
import { MAP_STYLE } from './mapSetup'
import { ATHENS_CENTER, type LatLng } from '../../domain/geo'
import type { Stop } from '../../domain/types'
import './StopsMap.css'

const STOP_ZOOM = 16

interface StopsMapProps {
  /** The map flies here whenever it changes */
  focus: LatLng | null
  userLocation: LatLng | null
  stops: Stop[]
  onSelectStop: (stop: Stop) => void
  onMoveEnd?: (center: LatLng) => void
}

export function StopsMap({ focus, userLocation, stops, onSelectStop, onMoveEnd }: StopsMapProps) {
  const mapRef = useRef<MapRef>(null)

  useEffect(() => {
    const map = mapRef.current
    if (focus && map) {
      map.flyTo({ center: [focus.lng, focus.lat], zoom: Math.max(map.getZoom(), STOP_ZOOM) })
    }
  }, [focus])

  const initial = focus ?? ATHENS_CENTER

  return (
    <Map
      ref={mapRef}
      initialViewState={{ longitude: initial.lng, latitude: initial.lat, zoom: focus ? STOP_ZOOM : 14 }}
      mapStyle={MAP_STYLE}
      style={{ position: 'absolute', inset: 0 }}
      onMoveEnd={(e) => {
        const { lat, lng } = e.target.getCenter()
        onMoveEnd?.({ lat, lng })
      }}
    >
      <NavigationControl position="top-right" showCompass={false} />

      {stops.map((stop) => (
        <Marker key={stop.code} longitude={stop.lng} latitude={stop.lat} anchor="center">
          <button
            type="button"
            className="stop-marker"
            title={stop.name}
            aria-label={`Stop ${stop.name}`}
            onClick={() => onSelectStop(stop)}
          />
        </Marker>
      ))}

      {userLocation && (
        <Marker longitude={userLocation.lng} latitude={userLocation.lat} anchor="center">
          <span className="user-marker" role="img" aria-label="Your location" />
        </Marker>
      )}
    </Map>
  )
}
