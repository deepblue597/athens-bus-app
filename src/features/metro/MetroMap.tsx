import { useMemo, useState } from 'react'
import Map, { Layer, NavigationControl, Source } from 'react-map-gl/maplibre'
import type { ExpressionSpecification } from 'maplibre-gl'
import { MAP_PIXEL_RATIO, MAP_STYLE, flattenBuildings } from '../map/mapSetup'
import type { MetroNetwork, MetroStation, TrainEstimate } from '../../domain/metro'

/** Piraeus to the airport, Anthoupoli to Elliniko and the tram to Voula */
const NETWORK_BOUNDS: [[number, number], [number, number]] = [
  [23.63, 37.82],
  [23.95, 38.08],
]

interface MetroMapProps {
  network: MetroNetwork
  trains: TrainEstimate[]
  onSelectStation: (station: MetroStation) => void
}

const isTram: ExpressionSpecification = ['==', ['get', 'mode'], 'tram']

/**
 * The metro and tram lines, stations and trains, the tram drawn thinner and smaller. Trains are GeoJSON circles updated with setData, not React
 * markers: some 60 of them move every couple of seconds, which markers would make heavy on phones.
 */
export function MetroMap({ network, trains, onSelectStation }: MetroMapProps) {
  const [hovering, setHovering] = useState(false)

  const lines = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      // A tram line has a track per direction: both are drawn, mostly on top of each other
      features: network.lines.flatMap((l) =>
        l.tracks.map((t) => ({
          type: 'Feature' as const,
          properties: { color: l.color, mode: l.mode },
          geometry: { type: 'LineString' as const, coordinates: t.path },
        })),
      ),
    }),
    [network],
  )
  const stations = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: network.stations.map((s) => ({
        type: 'Feature' as const,
        properties: { index: s.index, name: s.name, interchange: s.lines.length > 1, mode: s.mode },
        geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] },
      })),
    }),
    [network],
  )
  const trainData = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: trains.map((t) => ({
        type: 'Feature' as const,
        properties: { color: network.lines[t.line].color, mode: network.lines[t.line].mode },
        geometry: { type: 'Point' as const, coordinates: [t.lng, t.lat] },
      })),
    }),
    [network, trains],
  )

  return (
    <Map
      initialViewState={{ bounds: NETWORK_BOUNDS, fitBoundsOptions: { padding: 16 } }}
      mapStyle={MAP_STYLE}
      pixelRatio={MAP_PIXEL_RATIO}
      onStyleData={(e) => flattenBuildings(e.target)}
      style={{ position: 'absolute', inset: 0 }}
      interactiveLayerIds={['metro-stations-hit']}
      cursor={hovering ? 'pointer' : undefined}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onClick={(e) => {
        const index = e.features?.[0]?.properties?.index
        const station = typeof index === 'number' ? network.stations[index] : undefined
        if (station) {
          onSelectStation(station)
        }
      }}
    >
      <NavigationControl position="top-right" showCompass={false} />

      <Source id="metro-lines" type="geojson" data={lines}>
        <Layer
          id="metro-line-casing"
          type="line"
          layout={{ 'line-join': 'round', 'line-cap': 'round' }}
          paint={{
            'line-color': '#ffffff',
            'line-width': ['interpolate', ['linear'], ['zoom'], 10, ['case', isTram, 3.5, 5], 15, ['case', isTram, 7, 11]],
          }}
        />
        <Layer
          id="metro-lines"
          type="line"
          layout={{ 'line-join': 'round', 'line-cap': 'round' }}
          paint={{
            'line-color': ['get', 'color'],
            'line-width': ['interpolate', ['linear'], ['zoom'], 10, ['case', isTram, 1.75, 3], 15, ['case', isTram, 4, 7]],
          }}
        />
      </Source>

      <Source id="metro-stations" type="geojson" data={stations}>
        <Layer
          id="metro-stations"
          type="circle"
          paint={{
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              10,
              ['case', isTram, 1.75, ['get', 'interchange'], 4, 3],
              15,
              ['case', isTram, 5, ['get', 'interchange'], 9, 7],
            ],
            'circle-color': '#ffffff',
            'circle-stroke-color': '#333333',
            'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 10, ['case', isTram, 1, 1.5], 15, ['case', isTram, 2, 2.5]],
          }}
        />
        {/* Invisible, larger circles so stations are easy to tap */}
        <Layer
          id="metro-stations-hit"
          type="circle"
          paint={{ 'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, ['case', isTram, 8, 16], 14, 16], 'circle-opacity': 0 }}
        />
      </Source>

      {/* A ring with a dot in the line's colour: unlike a station, and unlike the app's live bus arrows */}
      <Source id="metro-trains" type="geojson" data={trainData}>
        <Layer
          id="metro-trains"
          type="circle"
          paint={{
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, ['case', isTram, 4, 5], 15, ['case', isTram, 7.5, 9]],
            'circle-color': '#ffffff',
            'circle-stroke-color': ['get', 'color'],
            'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 10, ['case', isTram, 2, 2.5], 15, ['case', isTram, 3, 3.5]],
          }}
        />
        <Layer
          id="metro-trains-core"
          type="circle"
          paint={{
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, ['case', isTram, 1.25, 1.5], 15, ['case', isTram, 3, 3.5]],
            'circle-color': ['get', 'color'],
          }}
        />
      </Source>

      {/* Names on top of everything, once zoomed in enough for them to fit: tram stops are closer together */}
      <Layer
        id="metro-station-labels"
        type="symbol"
        source="metro-stations"
        minzoom={12.5}
        filter={['any', ['!=', ['get', 'mode'], 'tram'], ['>=', ['zoom'], 14]]}
        layout={{
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 12,
          'text-anchor': 'top',
          'text-offset': [0, 0.9],
          'text-optional': true,
        }}
        paint={{ 'text-color': '#222222', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 }}
      />
    </Map>
  )
}
