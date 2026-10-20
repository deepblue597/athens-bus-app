import { setWorkerUrl, type Map as MaplibreMap } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import 'maplibre-gl/dist/maplibre-gl.css'

// MapLibre looks for its worker next to its own file, which Vite moves when bundling.
// Importing it with ?url makes Vite ship the worker and tells MapLibre where it is.
setWorkerUrl(workerUrl)

// Free vector tiles, no API key needed
export const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'

/** Phones have 3x screens; drawing the map at 2x is still sharp and less than half the pixel work */
export const MAP_PIXEL_RATIO = Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1, 2)

/**
 * The liberty style extrudes every building in 3D from zoom 14 (its flat "building" layer stops at
 * zoom 14), and the app opens at zoom 16 in central Athens, which is heavy for phone GPUs. This
 * hides the 3D layer and lets the flat outlines continue at every zoom instead.
 */
const BUILDINGS_3D = 'building-3d'
const BUILDINGS_FLAT = 'building'
const MAX_ZOOM = 24

/** Call on every style change (`onStyleData`): applies as soon as the layers exist, once */
export function flattenBuildings(map: MaplibreMap) {
  if (map.getLayer(BUILDINGS_3D) && map.getLayoutProperty(BUILDINGS_3D, 'visibility') !== 'none') {
    map.setLayoutProperty(BUILDINGS_3D, 'visibility', 'none')
  }
  const flat = map.getLayer(BUILDINGS_FLAT)
  if (flat && flat.maxzoom < MAX_ZOOM) {
    map.setLayerZoomRange(BUILDINGS_FLAT, flat.minzoom, MAX_ZOOM)
  }
}
