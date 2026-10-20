import { useState } from 'react'
import { useNavigate } from 'react-router'
import { StopsMap } from '../map/StopsMap'
import { useAllStops } from '../map/useAllStops'
import { useFavourites } from '../favourites/useFavourites'
import { ATHENS_CENTER, distanceInMeters, formatDistance, type LatLng } from '../../domain/geo'
import type { Stop } from '../../domain/types'
import { useUserLocation } from './useUserLocation'
import { MAX_NEARBY_METERS, useNearbyStops } from './useNearbyStops'
import './NearbyPage.css'

/** How far the map must move before offering to search the new area */
const SEARCH_AREA_MIN_METERS = 300

export function NearbyPage() {
  const navigate = useNavigate()
  const { location, locate } = useUserLocation()
  const [manualPoint, setManualPoint] = useState<LatLng | null>(null)
  const [mapCenter, setMapCenter] = useState<LatLng | null>(null)

  const userPoint = location.status === 'found' ? location.position : null
  const searchPoint = manualPoint ?? userPoint ?? (location.status === 'locating' ? null : ATHENS_CENTER)
  const nearby = useNearbyStops(searchPoint)
  const stops = nearby.data?.stops ?? []
  const allStops = useAllStops()
  const { favourites } = useFavourites()

  const canSearchArea =
    mapCenter !== null && searchPoint !== null && distanceInMeters(mapCenter, searchPoint) > SEARCH_AREA_MIN_METERS

  const openStop = (stop: Stop) => navigate(`/stop/${stop.code}`, { state: { stop } })

  const returnToMyLocation = () => {
    setManualPoint(null)
    locate()
  }

  return (
    <div className="nearby">
      <title>Nearby stops · Athens Bus</title>

      {/* The list comes first so keyboard and screen reader users reach it before the map markers */}
      <section className="nearby-panel" aria-labelledby="nearby-heading">
        <h1 id="nearby-heading" className="visually-hidden">
          Nearby stops
        </h1>

        {favourites.length > 0 && (
          <section aria-labelledby="favourites-heading">
            <h2 id="favourites-heading" className="nearby-section-title">
              Favourites
            </h2>
            <ul className="stop-list">
              {favourites.map((stop) => (
                <li key={stop.code}>
                  <button type="button" className="stop-list-item" onClick={() => openStop({ ...stop, street: null })}>
                    <span className="stop-list-name">
                      {stop.name}
                      {stop.nameEn && <span className="stop-list-name-en">{stop.nameEn}</span>}
                    </span>
                    {userPoint && (
                      <span className="stop-list-distance">{formatDistance(distanceInMeters(userPoint, stop))}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {/* The location status belongs to the nearby list, so it comes after the favourites */}
        {favourites.length > 0 && <h2 className="nearby-section-title">Nearby</h2>}
        <div className="nearby-status">
          <p aria-live="polite">{statusText(location.status, manualPoint !== null)}</p>
          {(manualPoint !== null || location.status !== 'found') && location.status !== 'locating' && (
            <button type="button" className="link-button" onClick={returnToMyLocation}>
              Use my location
            </button>
          )}
        </div>

        <div aria-live="polite">
          {nearby.data?.fromFile && (
            <p className="nearby-message">Live data is unavailable, so these stops come from the saved stop list.</p>
          )}
          {nearby.isError && (
            <p className="nearby-message">
              Couldn’t load stops.{' '}
              <button type="button" className="link-button" onClick={() => nearby.refetch()}>
                Try again
              </button>
            </p>
          )}
          {nearby.isFetching && stops.length === 0 && <p className="nearby-message">Loading stops…</p>}
          {nearby.isSuccess && stops.length === 0 && (
            <p className="nearby-message">No stops within {formatDistance(MAX_NEARBY_METERS)}.</p>
          )}
        </div>

        <ul className="stop-list">
          {stops.map((stop) => (
            <li key={stop.code}>
              <button type="button" className="stop-list-item" onClick={() => openStop(stop)}>
                <span className="stop-list-name">
                  {stop.name}
                  {stop.nameEn && <span className="stop-list-name-en">{stop.nameEn}</span>}
                </span>
                <span className="stop-list-distance">{formatDistance(stop.distanceMeters)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className="nearby-map">
        <StopsMap
          focus={searchPoint}
          userLocation={userPoint}
          stops={stops}
          allStops={allStops.data}
          onSelectStop={openStop}
          onMoveEnd={setMapCenter}
        />
        {canSearchArea && (
          <button type="button" className="nearby-search-area" onClick={() => setManualPoint(mapCenter)}>
            Search this area
          </button>
        )}
      </div>
    </div>
  )
}

function statusText(status: ReturnType<typeof useUserLocation>['location']['status'], manual: boolean) {
  if (manual) {
    return 'Stops near the map centre'
  }
  switch (status) {
    case 'locating':
      return 'Finding your location…'
    case 'found':
      return 'Stops near you'
    case 'denied':
      return 'Location is off. Showing stops near Syntagma. Move the map to search elsewhere.'
    case 'unavailable':
      return 'Couldn’t get your location. Showing stops near Syntagma.'
  }
}
