import Map, { NavigationControl } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'

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
