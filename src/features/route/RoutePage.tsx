import { Link, useLocation, useNavigate, useParams } from 'react-router'
import type { Stop, StopRoute } from '../../domain/types'
import { RouteMap } from './RouteMap'
import { useRouteDetails } from './useRouteDetails'
import './RoutePage.css'

export interface RoutePageState {
  route?: StopRoute
  /** The stop the user came from, highlighted on the map and in the list */
  fromStopCode?: string
  /** Its details, when the previous page had them */
  fromStop?: Stop
}

export function RoutePage() {
  const { routeCode = '' } = useParams()
  const navigate = useNavigate()
  const { route: routeInfo, fromStopCode, fromStop } = (useLocation().state as RoutePageState | null) ?? {}
  const { data: route, isValidCode, isPending, isError, refetch } = useRouteDetails(routeCode)

  const openStop = (stop: Stop) => navigate(`/stop/${stop.code}`, { state: { stop } })
  const title = routeInfo ? `${routeInfo.lineId} ${routeInfo.routeName}` : `Route ${routeCode}`

  return (
    <div className="route-page">
      <title>{`${title} · Athens Bus`}</title>

      <header className="route-header">
        {fromStopCode ? (
          <Link to={`/stop/${fromStopCode}`} state={{ stop: fromStop }} className="route-back">
            <span aria-hidden="true">←</span> {fromStop?.name ?? 'Back to stop'}
          </Link>
        ) : (
          <Link to="/" className="route-back">
            <span aria-hidden="true">←</span> Nearby stops
          </Link>
        )}
        <div className="route-title">
          {routeInfo && <span className="line-badge">{routeInfo.lineId}</span>}
          <h1>{routeInfo?.routeName ?? `Route ${routeCode}`}</h1>
        </div>
      </header>

      <div className="route-map">
        {route && route.path.length + route.stops.length > 0 && (
          <RouteMap route={route} highlightedStopCode={fromStopCode} onSelectStop={openStop} />
        )}
      </div>

      <section className="route-stops" aria-label="Stops on this route">
        {!isValidCode && <p className="route-message">“{routeCode}” isn’t a valid route code.</p>}
        {isPending && <p className="route-message">Loading route…</p>}
        {isError && (
          <p className="route-message">
            Couldn’t load the route.{' '}
            <button type="button" className="link-button" onClick={() => refetch()}>
              Try again
            </button>
          </p>
        )}
        {route && route.stops.length === 0 && <p className="route-message">No stops found for this route.</p>}

        <ol className="route-stop-list">
          {route?.stops.map((stop) => (
            // Circular routes list their first stop again at the end, so the code alone isn't unique
            <li key={`${stop.code}-${stop.order}`}>
              <button
                type="button"
                className="route-stop-item"
                aria-current={stop.code === fromStopCode ? 'location' : undefined}
                onClick={() => openStop(stop)}
              >
                <span className="route-stop-order">{stop.order}</span>
                <span className="route-stop-name">
                  {stop.name}
                  {stop.nameEn && <span className="route-stop-name-en">{stop.nameEn}</span>}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
