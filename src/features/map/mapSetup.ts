import { setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import 'maplibre-gl/dist/maplibre-gl.css'

// MapLibre looks for its worker next to its own file, which Vite moves when bundling.
// Importing it with ?url makes Vite ship the worker and tells MapLibre where it is.
setWorkerUrl(workerUrl)

// Free vector tiles, no API key needed
export const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'
