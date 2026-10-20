import { useCallback, useMemo, useRef } from 'react'
import Map, { Layer, Marker, NavigationControl, Source, type MapRef } from 'react-map-gl/maplibre'
import { MAP_STYLE } from '../map/mapSetup'
import type { RouteDetails, RouteStop } from '../../domain/route'
import './RouteMap.css'

const ROUTE_COLOR = '#1565c0'

interface RouteMapProps {
  route: RouteDetails
  highlightedStopCode?: string
  onSelectStop: (stop: RouteStop) => void
}

export function RouteMap({ route, highlightedStopCode, onSelectStop }: RouteMapProps) {
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
    </Map>
  )
}
