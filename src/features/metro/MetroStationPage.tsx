import { useMemo } from 'react'
import { Link, useParams } from 'react-router'
import type { Departure } from '../../domain/metro'
import { nextDepartures } from '../../domain/trainPositions'
import { useNow } from '../../shared/useNow'
import { MetroCredit, MetroLineBadge, TimetableNotice } from './MetroParts'
import { useMetroNetwork } from './useMetroNetwork'
import './Metro.css'

const REFRESH_MS = 15_000

const timeFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Athens' })

export function MetroStationPage() {
  const { stationId = '' } = useParams()
  const { data: network, isPending, isError, refetch } = useMetroNetwork()
  const now = useNow(REFRESH_MS)
  const station = network?.stationById.get(stationId)
  const groups = useMemo(
    () => (network && station ? nextDepartures(network, station.index, now) : []),
    [network, station, now],
  )

  const title = station?.name ?? 'Metro station'

  return (
    <section className="metro-station-page">
      <title>{`${title} · Metro · Athens Bus`}</title>

      <Link to="/metro" className="metro-back">
        <span aria-hidden="true">←</span> Metro
      </Link>

      {isPending && <p className="metro-message">Loading the metro timetable…</p>}
      {isError && (
        <p className="metro-message">
          Couldn’t load the metro timetable.{' '}
          <button type="button" className="link-button" onClick={() => refetch()}>
            Try again
          </button>
        </p>
      )}
      {network && !station && <p className="metro-message">There’s no metro station “{stationId}”.</p>}

      {network && station && (
        <>
          <header className="metro-station-header">
            <h1>{station.name}</h1>
            <p className="metro-station-subtitle">
              {station.nameEn}
              {station.lines.map((l) => (
                <MetroLineBadge key={l} line={network.lines[l]} />
              ))}
            </p>
          </header>

          <p className="metro-scheduled">Scheduled departures from STASY’s timetable, not live.</p>
          <TimetableNotice network={network} now={now} />

          {groups.length === 0 && <p className="metro-message">No trains are scheduled from this station.</p>}

          {groups.map((group) => {
            const line = network.lines[group.line]
            const towards = network.stations[group.towards]
            const headingId = `towards-${line.id}-${towards.id}`
            return (
              <section key={headingId} className="metro-direction" aria-labelledby={headingId}>
                <h2 id={headingId}>
                  <MetroLineBadge line={line} />
                  <span>
                    to {towards.name}
                    <span className="metro-direction-en">{towards.nameEn}</span>
                  </span>
                </h2>
                <ul className="metro-departures">
                  {group.departures.map((d) => (
                    <li key={d.key} className="metro-departure">
                      <span className="metro-departure-time">{timeFormat.format(d.time)}</span>
                      <span className="metro-departure-dest">
                        {d.destination !== group.towards && `Terminates at ${network.stations[d.destination].name}`}
                      </span>
                      <span className="metro-departure-in">{inLabel(d, now)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}

          <MetroCredit />
        </>
      )}
    </section>
  )
}

/** "~4 min": trains run to headways and drift from the timetable, so whole minutes at best */
function inLabel(d: Departure, now: number): string {
  const minutes = Math.round((d.time - now) / 60_000)
  if (minutes <= 0) return 'now'
  if (minutes < 60) return `~${minutes} min`
  return ''
}
