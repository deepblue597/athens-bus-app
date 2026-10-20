import Map, { NavigationControl } from 'react-map-gl/maplibre'
import { setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import 'maplibre-gl/dist/maplibre-gl.css'

// MapLibre looks for its worker next to its own file, which Vite moves when bundling.
// Importing it with ?url makes Vite ship the worker and tells MapLibre where it is.
setWorkerUrl(workerUrl)

// Free vector tiles, no API key needed
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'

const ATHENS_CENTER = { longitude: 23.7275, latitude: 37.9838 }

export function StopsMap() {
  return (
    <Map initialViewState={{ ...ATHENS_CENTER, zoom: 13 }} mapStyle={MAP_STYLE} style={{ flex: 1 }}>
      <NavigationControl position="top-right" />
    </Map>
  )
}
