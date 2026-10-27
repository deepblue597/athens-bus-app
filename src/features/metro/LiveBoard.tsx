import { expectedTime, isLongDistance, type BoardTrain } from '../../domain/stationBoard'
import { RefreshTimer } from '../../shared/RefreshTimer'
import { BOARD_REFRESH_MS, useStationBoard } from './useStationBoard'

const timeFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Athens' })
const clockFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Athens' })

/** Trains still shown this long after they were due to leave (or arrive), as "now" */
const JUST_LEFT_MS = 60_000

/**
 * The live departures and arrivals at a Proastiakos station, from OSE's station screens.
 * `proastiakosNames` tells Proastiakos trains from long-distance ones, which the screens list too.
 */
export function LiveBoard({ board, now, proastiakosNames }: { board: number; now: number; proastiakosNames: readonly string[] }) {
  const { data, isPending, isPaused, isError, isFetching, dataUpdatedAt, refetch } = useStationBoard(board)
  // A cancelled train stays on the list until its time, so nobody waits for it
  const upcoming = (data?.trains ?? []).filter((t) => (t.cancelled ? t.scheduled : expectedTime(t)) >= now - JUST_LEFT_MS)
  const departures = upcoming.filter((t) => !t.terminates)
  // Trains ending here, for anyone meeting one
  const arrivals = upcoming.filter((t) => t.terminates)

  return (
    <section className="live-board" aria-labelledby="live-board-heading">
      <div className="live-board-toolbar">
        <h2 id="live-board-heading">
          Live departures
          <span className="live-board-source">
            {dataUpdatedAt > 0 ? `OSE · updated ${clockFormat.format(dataUpdatedAt)}` : 'OSE station screens'}
          </span>
        </h2>
        <RefreshTimer
          intervalMs={BOARD_REFRESH_MS}
          updatedAt={dataUpdatedAt}
          isFetching={isFetching}
          onRefresh={() => refetch({ cancelRefetch: false })}
          label="Refresh live departures"
        />
      </div>

      <div aria-live="polite">
        {isPending && <p className="metro-message">{isPaused ? 'Live departures will load when you’re back online.' : 'Loading live departures…'}</p>}
        {isError && !data && (
          <p className="metro-message">
            Live departures are unavailable right now; the timetable is below.{' '}
            <button type="button" className="link-button" onClick={() => refetch({ cancelRefetch: false })}>
              Try again
            </button>
          </p>
        )}
        {isError && data && <p className="metro-message live-board-stale">Couldn’t refresh. Showing the last update.</p>}
        {data && departures.length === 0 && arrivals.length === 0 && <p className="metro-message">No trains on the board right now.</p>}
      </div>

      {data?.notices.map((notice) => (
        <p key={notice} className="metro-notice" lang="el">
          {notice}
        </p>
      ))}

      {departures.length > 0 && (
        <ul className="metro-departures" aria-label="Live departures">
          {departures.map((t) => (
            <LiveTrain key={`${t.train}-${t.scheduled}`} train={t} now={now} longDistance={isLongDistance(t, proastiakosNames)} />
          ))}
        </ul>
      )}

      {arrivals.length > 0 && (
        <>
          <h3 className="live-arrivals-heading">Arriving</h3>
          <ul className="metro-departures" aria-label="Live arrivals">
            {arrivals.map((t) => (
              <LiveTrain key={`${t.train}-${t.scheduled}`} train={t} now={now} longDistance={isLongDistance(t, proastiakosNames)} />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

/** A departure ("to …") or, for a train ending here, an arrival ("from …") */
function LiveTrain({ train, now, longDistance }: { train: BoardTrain; now: number; longDistance: boolean }) {
  const minutes = Math.round((expectedTime(train) - now) / 60_000)
  const late = !train.cancelled && train.delayMinutes > 0
  const [place, placeEn] = train.terminates ? [train.origin, train.originEn] : [train.destination, train.destinationEn]
  return (
    <li className={`metro-departure live-departure${train.cancelled ? ' live-cancelled' : ''}`}>
      <span className="metro-departure-time">
        <span className="live-scheduled">{timeFormat.format(train.scheduled)}</span>
        {late && (
          <span className="live-delay">
            <span className="visually-hidden">, </span>+{train.delayMinutes} min<span className="visually-hidden"> late</span>
          </span>
        )}
      </span>
      <span className="metro-departure-dest">
        <span className="live-destination">
          {train.terminates ? 'from' : 'to'} <span lang="el">{place}</span>
        </span>
        <span className="live-train">
          {placeEn}
          {longDistance && (
            <>
              {' · '}
              <span className="live-long-distance">long-distance</span>
            </>
          )}
          {' · '}train {train.train}
          {train.platform && ` · platform ${train.platform}`}
        </span>
        {train.remark && (
          <span className="live-remark" lang="el">
            {train.remark}
          </span>
        )}
      </span>
      {train.cancelled ? (
        <span className="live-cancelled-label">Cancelled</span>
      ) : (
        <span className="metro-departure-in">{minutes <= 0 ? 'now' : minutes < 60 ? `${minutes} min` : ''}</span>
      )}
    </li>
  )
}
