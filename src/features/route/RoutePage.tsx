import { Link, useLocation, useNavigate, useParams } from 'react-router'
import type { Stop, StopRoute } from '../../domain/types'
import { RouteMap } from './RouteMap'
import { BUS_REFRESH_MS, useBusLocations } from './useBusLocations'
import { useRouteDetails } from './useRouteDetails'
import './RoutePage.css'

export interface RoutePageState {
  route?: StopRoute
  /** The stop the user came from, highlighted on the map and in the list */
  fromStopCode?: string
  /** Its details, when the previous page had them */
  fromStop?: Stop
  /** Set when coming from a line's timetable, so the back link returns there */
  fromLine?: { code: string; id: string; name: string }
  /** Set when coming from an arrival: that bus is highlighted on the map */
  trackedBus?: { vehicleCode: string; minutes: number }
}

/** Positions older than this are hidden: the bus has probably finished its trip or lost signal */
const BUS_HIDE_MS = 10 * 60_000

export function RoutePage() {
  const { routeCode = '' } = useParams()
  const navigate = useNavigate()
  const { route: routeInfo, fromStopCode, fromStop, fromLine, trackedBus } =
    (useLocation().state as RoutePageState | null) ?? {}
  const { data: route, isValidCode, isPending, isPaused, isError, refetch } = useRouteDetails(routeCode)
  const busQuery = useBusLocations(routeCode)
  // Positions are aged against the time they were fetched, which moves on with every poll
  const now = busQuery.dataUpdatedAt
  const buses = (busQuery.data ?? []).filter((b) => b.reportedAt === null || now - b.reportedAt < BUS_HIDE_MS)
  const trackedIsLive = trackedBus !== undefined && buses.some((b) => b.vehicleCode === trackedBus.vehicleCode)

  const openStop = (stop: Stop) => navigate(`/stop/${stop.code}`, { state: { stop } })
  const title = routeInfo ? `${routeInfo.lineId} ${routeInfo.routeName}` : `Route ${routeCode}`

  return (
    <div className="route-page">
      <title>{`${title} · Athens Bus`}</title>

      <header className="route-header">
        {fromLine ? (
          <Link
            to={`/line/${fromLine.code}`}
            state={{ lineHint: { id: fromLine.id, name: fromLine.name } }}
            className="route-back"
          >
            <span aria-hidden="true">←</span> {fromLine.id} timetable
          </Link>
        ) : fromStopCode ? (
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
        {routeInfo && !fromLine && (
          <Link
            to={`/line/${routeInfo.lineCode}`}
            state={{ lineHint: { id: routeInfo.lineId, name: routeInfo.lineName } }}
            className="route-timetable-link"
          >
            Timetable <span aria-hidden="true">›</span>
          </Link>
        )}
        {busQuery.isSuccess && (
          <p className="route-buses">
            {buses.length === 0
              ? 'No buses are reporting on this route right now.'
              : `${buses.length} ${buses.length === 1 ? 'bus' : 'buses'} on this route`}
            {trackedBus &&
              (trackedIsLive
                ? ` · yours (${trackedBus.minutes <= 0 ? 'arriving now' : `in ${trackedBus.minutes} min`}) is green`
                : ' · your bus isn’t reporting its position')}
            <span className="route-buses-updated">
              {' '}
              · updated every {BUS_REFRESH_MS / 1000} s
            </span>
          </p>
        )}
      </header>

      <div className="route-map">
        {route && route.path.length + route.stops.length > 0 && (
          <RouteMap
            route={route}
            highlightedStopCode={fromStopCode}
            buses={buses}
            trackedVehicle={trackedBus?.vehicleCode}
            now={now}
            onSelectStop={openStop}
          />
        )}
      </div>

      <section className="route-stops" aria-label="Stops on this route">
        {!isValidCode && <p className="route-message">“{routeCode}” isn’t a valid route code.</p>}
        {/* Paused: offline, and TanStack Query waits for the connection */}
        {isPending && (
          <p className="route-message">
            {isPaused ? 'This route isn’t saved on this device. It will load when you’re back online.' : 'Loading route…'}
          </p>
        )}
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
