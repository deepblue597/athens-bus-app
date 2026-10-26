import { useEffect, useMemo, useRef, useState } from 'react'
import Map, { Layer, Marker, NavigationControl, Source, type MapRef } from 'react-map-gl/maplibre'
import { MAP_PIXEL_RATIO, MAP_STYLE, flattenBuildings } from './mapSetup'
import { ATHENS_CENTER, distanceInMeters, type LatLng } from '../../domain/geo'
import type { MapStop, Stop } from '../../domain/types'
import './StopsMap.css'

const STOP_ZOOM = 16
/** Every stop is drawn as a small dot from this zoom level; below it the dots would just be noise */
const ALL_STOPS_MIN_ZOOM = 13
/** Rail stations are fewer and further apart, so they show from further out */
const RAIL_MIN_ZOOM = 11
const RAIL_LABELS_MIN_ZOOM = 14

/** A metro or Proastiakos station or a tram stop, for the map */
export interface RailMapStation {
  id: string
  name: string
  lat: number
  lng: number
  /** Its (first) line's colour */
  color: string
}

interface StopsMapProps {
  /** The map flies here whenever it changes */
  focus: LatLng | null
  userLocation: LatLng | null
  /** Highlighted stops (the nearby ones), drawn as large markers */
  stops: Stop[]
  /** Every stop, drawn as small tappable dots */
  allStops?: MapStop[]
  /** Rail stations, drawn as rings in their line's colour */
  railStations?: RailMapStation[]
  onSelectStop: (stop: Stop) => void
  onSelectRailStation?: (id: string) => void
  onMoveEnd?: (center: LatLng) => void
}

export function StopsMap({
  focus,
  userLocation,
  stops,
  allStops = [],
  railStations = [],
  onSelectStop,
  onSelectRailStation,
  onMoveEnd,
}: StopsMapProps) {
  const mapRef = useRef<MapRef>(null)
  const [hoveringStop, setHoveringStop] = useState(false)

  // The first move to the user's position jumps (flying there would load tiles all along the way);
  // later moves, e.g. "Search this area" or "Use my location", fly
  const hasFocused = useRef(false)
  useEffect(() => {
    const map = mapRef.current
    if (focus && map) {
      const camera = { center: [focus.lng, focus.lat] as [number, number], zoom: Math.max(map.getZoom(), STOP_ZOOM) }
      if (hasFocused.current) {
        map.flyTo(camera)
      } else {
        map.jumpTo(camera)
      }
      hasFocused.current = true
    }
  }, [focus])

  const allStopsData = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: allStops.map((s) => ({
        type: 'Feature' as const,
        properties: { code: s.code },
        geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] },
      })),
    }),
    [allStops],
  )
  // `Map` here is the map component, hence globalThis.Map
  const stopsByCode = useMemo(() => new globalThis.Map(allStops.map((s) => [s.code, s])), [allStops])
  const railData = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: railStations.map((s) => ({
        type: 'Feature' as const,
        properties: { id: s.id, name: s.name, color: s.color },
        geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] },
      })),
    }),
    [railStations],
  )

  const initial = focus ?? ATHENS_CENTER

  return (
    <Map
      ref={mapRef}
      initialViewState={{ longitude: initial.lng, latitude: initial.lat, zoom: focus ? STOP_ZOOM : 14 }}
      mapStyle={MAP_STYLE}
      pixelRatio={MAP_PIXEL_RATIO}
      onStyleData={(e) => flattenBuildings(e.target)}
      style={{ position: 'absolute', inset: 0 }}
      interactiveLayerIds={['all-stops-hit', 'rail-stations-hit']}
      cursor={hoveringStop ? 'pointer' : undefined}
      onMouseEnter={() => setHoveringStop(true)}
      onMouseLeave={() => setHoveringStop(false)}
      onClick={(e) => {
        // MapLibre sees clicks on the large markers before React does, so ignore them here
        if ((e.originalEvent.target as HTMLElement | null)?.closest('.maplibregl-marker')) {
          return
        }
        // A station is the bigger target: it wins over a bus stop next to it
        const station = e.features?.find((f) => f.layer.id === 'rail-stations-hit')
        if (station) {
          onSelectRailStation?.(String(station.properties?.id))
          return
        }
        // Tap areas of neighbouring dots overlap when zoomed out; take the one closest to the tap
        const tapped = (e.features ?? [])
          .map((f) => stopsByCode.get(String(f.properties?.code)))
          .filter((stop) => stop !== undefined)
        const closest = tapped.reduce<MapStop | undefined>(
          (best, stop) =>
            !best || distanceInMeters(e.lngLat, stop) < distanceInMeters(e.lngLat, best) ? stop : best,
          undefined,
        )
        if (closest) {
          onSelectStop(closest)
        }
      }}
      onMoveEnd={(e) => {
        const { lat, lng } = e.target.getCenter()
        onMoveEnd?.({ lat, lng })
      }}
    >
      <NavigationControl position="top-right" showCompass={false} />

      <Source id="all-stops" type="geojson" data={allStopsData}>
        <Layer
          id="all-stops"
          type="circle"
          minzoom={ALL_STOPS_MIN_ZOOM}
          paint={{
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 2.5, 16, 5, 18, 7],
            'circle-color': '#ffffff',
            'circle-stroke-color': '#1565c0',
            'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 13, 1, 16, 2],
          }}
        />
        {/* Invisible, larger circles so the small dots are easy to tap */}
        <Layer
          id="all-stops-hit"
          type="circle"
          minzoom={ALL_STOPS_MIN_ZOOM}
          paint={{ 'circle-radius': 14, 'circle-opacity': 0, 'circle-stroke-opacity': 0 }}
        />
      </Source>

      {/* Above the bus stops: a ring in the line's colour, like the Rail tab's stations */}
      <Source id="rail-stations" type="geojson" data={railData}>
        <Layer
          id="rail-stations"
          type="circle"
          minzoom={RAIL_MIN_ZOOM}
          paint={{
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 4, 16, 8, 18, 10],
            'circle-color': '#ffffff',
            'circle-stroke-color': ['get', 'color'],
            'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 11, 2, 16, 4],
          }}
        />
        <Layer
          id="rail-stations-hit"
          type="circle"
          minzoom={RAIL_MIN_ZOOM}
          paint={{ 'circle-radius': 18, 'circle-opacity': 0, 'circle-stroke-opacity': 0 }}
        />
        <Layer
          id="rail-station-labels"
          type="symbol"
          minzoom={RAIL_LABELS_MIN_ZOOM}
          layout={{
            'text-field': ['get', 'name'],
            'text-font': ['Noto Sans Regular'],
            'text-size': 12,
            'text-anchor': 'top',
            'text-offset': [0, 1],
            'text-optional': true,
          }}
          paint={{ 'text-color': '#222222', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 }}
        />
      </Source>

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
