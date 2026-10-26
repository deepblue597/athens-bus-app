import { expectedTime, type BoardTrain } from '../../domain/stationBoard'
import { RefreshTimer } from '../../shared/RefreshTimer'
import { BOARD_REFRESH_MS, useStationBoard } from './useStationBoard'

const timeFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Athens' })
const clockFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Athens' })

/** Trains still shown this long after they were due to leave, as "now" */
const JUST_LEFT_MS = 60_000

/** The live departures at a Proastiakos station, from OSE's station screens */
export function LiveBoard({ board, now }: { board: number; now: number }) {
  const { data, isPending, isPaused, isError, isFetching, dataUpdatedAt, refetch } = useStationBoard(board)
  // Trains ending here only arrive; the board lists them too
  const departures = (data?.trains ?? []).filter((t) => !t.terminates && expectedTime(t) >= now - JUST_LEFT_MS)

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
        {data && departures.length === 0 && <p className="metro-message">No departures on the board right now.</p>}
      </div>

      {data?.notices.map((notice) => (
        <p key={notice} className="metro-notice" lang="el">
          {notice}
        </p>
      ))}

      {departures.length > 0 && (
        <ul className="metro-departures" aria-label="Live departures">
          {departures.map((t) => (
            <LiveDeparture key={`${t.train}-${t.scheduled}`} train={t} now={now} />
          ))}
        </ul>
      )}
    </section>
  )
}

function LiveDeparture({ train, now }: { train: BoardTrain; now: number }) {
  const expected = expectedTime(train)
  const minutes = Math.round((expected - now) / 60_000)
  const late = train.delayMinutes > 0
  return (
    <li className="metro-departure live-departure">
      <span className="metro-departure-time">
        {timeFormat.format(train.scheduled)}
        {late && (
          <span className="live-delay">
            <span className="visually-hidden">, </span>+{train.delayMinutes} min<span className="visually-hidden"> late</span>
          </span>
        )}
      </span>
      <span className="metro-departure-dest">
        <span className="live-destination">
          to <span lang="el">{train.destination}</span>
        </span>
        <span className="live-train">
          {train.destinationEn} · train {train.train}
          {train.platform && ` · platform ${train.platform}`}
        </span>
      </span>
      <span className="metro-departure-in">{minutes <= 0 ? 'now' : minutes < 60 ? `${minutes} min` : ''}</span>
    </li>
  )
}
