import { Link, useLocation, useParams } from 'react-router'
import type { Stop } from '../../domain/types'
import { routeState } from './routeState'
import { StopLinesSheet } from './StopLinesSheet'
import { ARRIVALS_REFRESH_MS, useStopArrivals } from './useStopArrivals'
import './StopPage.css'

export function StopPage() {
  const { stopCode = '' } = useParams()
  // The stop's details come from the page that linked here; a shared link only has the code
  const stop = (useLocation().state as { stop?: Stop } | null)?.stop
  const { isValidCode, arrivals, routes, isLoading, isError, isFetching, updatedAt, refetch } =
    useStopArrivals(stopCode)
  // Unknown stops and stops no line serves both come back empty (about a quarter of the stops near Syntagma)
  const isUnserved = routes?.length === 0

  const title = stop?.name ?? `Stop ${stopCode}`

  return (
    <section className="stop-page">
      <title>{`${title} · Athens Bus`}</title>

      <Link to="/" className="stop-back">
        <span aria-hidden="true">←</span> Nearby stops
      </Link>

      <header className="stop-header">
        <div>
          <h1>{title}</h1>
          {stop && (
            <p className="stop-subtitle">{[stop.nameEn, stop.street, `No. ${stop.displayId}`].filter(Boolean).join(' · ')}</p>
          )}
        </div>
        {routes && routes.length > 0 && <StopLinesSheet routes={routes} stopCode={stopCode} stop={stop} />}
      </header>

      <div className="arrivals-toolbar">
        <span>
          {updatedAt > 0
            ? `Updated ${new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
            : 'Live arrivals'}{' '}
          · refreshes every {ARRIVALS_REFRESH_MS / 1000} s
        </span>
        {/* Not disabled while fetching: disabling would drop keyboard focus */}
        <button
          type="button"
          className="link-button"
          onClick={() => refetch({ cancelRefetch: false })}
          aria-busy={isFetching}
        >
          {isFetching ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div aria-live="polite">
        {!isValidCode && <p className="arrivals-message">“{stopCode}” isn’t a valid stop code.</p>}
        {isLoading && <p className="arrivals-message">Loading arrivals…</p>}
        {isError && !arrivals && (
          <p className="arrivals-message">
            Live arrivals are unavailable right now.{' '}
            <button type="button" className="link-button" onClick={() => refetch({ cancelRefetch: false })}>
              Try again
            </button>
          </p>
        )}
        {isError && arrivals && (
          <p className="arrivals-message arrivals-stale">Couldn’t refresh. Showing the last update.</p>
        )}
        {arrivals?.length === 0 &&
          (isUnserved ? (
            <p className="arrivals-message">No lines serve this stop.</p>
          ) : (
            <p className="arrivals-message">No buses are expected at this stop right now.</p>
          ))}
      </div>

      <ul className="arrival-list" aria-label="Arrivals">
        {arrivals?.map((a) => (
          <li key={`${a.routeCode}-${a.vehicleCode}`}>
            <Link
              to={`/route/${a.routeCode}`}
              state={routeState(a.route, stopCode, stop)}
              className="arrival"
              aria-label={`${a.route ? `Line ${a.route.lineId}, ${a.route.routeName}` : `Route ${a.routeCode}`}, ${minutesLabel(a.minutes)}. Show route on map`}
            >
              <span className="line-badge">{a.route?.lineId ?? '?'}</span>
              <span className="arrival-route">{a.route?.routeName ?? `Route ${a.routeCode}`}</span>
              <span className="arrival-minutes">{minutesLabel(a.minutes)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function minutesLabel(minutes: number) {
  return minutes <= 0 ? 'Now' : `${minutes} min`
}
