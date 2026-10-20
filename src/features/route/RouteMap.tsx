import { useCallback, useMemo, useRef } from 'react'
import Map, { Layer, Marker, NavigationControl, Source, type MapRef } from 'react-map-gl/maplibre'
import { MAP_STYLE } from '../map/mapSetup'
import type { RouteDetails, RouteStop } from '../../domain/route'
import type { BusLocation } from '../../domain/types'
import './RouteMap.css'

const ROUTE_COLOR = '#1565c0'
/** A bus that hasn't reported for this long is drawn faded */
const BUS_STALE_MS = 2 * 60_000

interface RouteMapProps {
  route: RouteDetails
  highlightedStopCode?: string
  /** Live buses on the route, already without positions too old to show */
  buses?: BusLocation[]
  /** The bus arriving at the user's stop, drawn in a different colour */
  trackedVehicle?: string
  /** Current time (epoch ms), to fade buses that stopped reporting */
  now: number
  onSelectStop: (stop: RouteStop) => void
}

export function RouteMap({ route, highlightedStopCode, buses = [], trackedVehicle, now, onSelectStop }: RouteMapProps) {
  const mapRef = useRef<MapRef>(null)

  const line = useMemo(
    () => ({
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates: route.path.map((p) => [p.lng, p.lat]) },
    }),
    [route.path],
  )

  const fitRoute = useCallback(() => {
    const points = route.path.length > 0 ? route.path : route.stops
    if (points.length === 0) {
      return
    }
    const lngs = points.map((p) => p.lng)
    const lats = points.map((p) => p.lat)
    mapRef.current?.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 40, duration: 0 },
    )
  }, [route])

  return (
    <Map ref={mapRef} mapStyle={MAP_STYLE} style={{ position: 'absolute', inset: 0 }} onLoad={fitRoute}>
      <NavigationControl position="top-right" showCompass={false} />

      <Source id="route" type="geojson" data={line}>
        <Layer
          id="route-line"
          type="line"
          layout={{ 'line-join': 'round', 'line-cap': 'round' }}
          paint={{ 'line-color': ROUTE_COLOR, 'line-width': 5, 'line-opacity': 0.85 }}
        />
      </Source>

      {route.stops.map((stop) => {
        const highlighted = stop.code === highlightedStopCode
        return (
          <Marker key={`${stop.code}-${stop.order}`} longitude={stop.lng} latitude={stop.lat} anchor="center" style={{ zIndex: highlighted ? 1 : 0 }}>
            <button
              type="button"
              className={highlighted ? 'route-stop-marker route-stop-marker--highlighted' : 'route-stop-marker'}
              title={stop.name}
              aria-label={`Stop ${stop.order}: ${stop.name}`}
              onClick={() => onSelectStop(stop)}
            />
          </Marker>
        )
      })}

      {buses.map((bus) => {
        const tracked = bus.vehicleCode === trackedVehicle
        const stale = bus.reportedAt !== null && now - bus.reportedAt > BUS_STALE_MS
        const className = ['bus-marker', tracked && 'bus-marker--tracked', stale && 'bus-marker--stale'].filter(Boolean).join(' ')
        return (
          <Marker
            key={bus.vehicleCode}
            longitude={bus.lng}
            latitude={bus.lat}
            anchor="center"
            // Rotates with the map, so the arrow keeps pointing the way the bus drives
            rotation={bus.heading ?? 0}
            rotationAlignment="map"
            style={{ zIndex: tracked ? 3 : 2 }}
          >
            <span className={className} role="img" aria-label={busLabel(bus, tracked, now)}>
              {bus.heading !== null && (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 4 18 18 12 14.5 6 18Z" />
                </svg>
              )}
            </span>
          </Marker>
        )
      })}
    </Map>
  )
}

function busLabel(bus: BusLocation, tracked: boolean, now: number): string {
  const who = tracked ? 'Your bus' : 'Bus'
  if (bus.reportedAt === null) {
    return who
  }
  const minutes = Math.max(0, Math.round((now - bus.reportedAt) / 60_000))
  return `${who}, position from ${minutes === 0 ? 'just now' : `${minutes} min ago`}`
}
