import { useMemo } from 'react'
import { Link, useParams } from 'react-router'
import { distanceInMeters, formatDistance } from '../../domain/geo'
import type { Departure, MetroNetwork, MetroStation } from '../../domain/metro'
import { nextDepartures, oneWayTowards } from '../../domain/trainPositions'
import { useNow } from '../../shared/useNow'
import { MetroCredit, MetroLineBadge, TimetableNotice } from './MetroParts'
import { useMetroNetwork } from './useMetroNetwork'
import './Metro.css'

const REFRESH_MS = 15_000
/** Tram stops and metro stations this close are worth changing between (Ακτή Ποσειδώνος – Πειραιάς is 360 m) */
const CHANGE_WITHIN_M = 400

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

  const nearby = useMemo(() => (network && station ? changeNearby(network, station) : []), [network, station])

  const title = station?.name ?? 'Station'

  return (
    <section className="metro-station-page">
      <title>{`${title} · Rail · Athens Bus`}</title>

      <Link to="/rail" className="metro-back">
        <span aria-hidden="true">←</span> Rail
      </Link>

      {isPending && <p className="metro-message">Loading the timetable…</p>}
      {isError && (
        <p className="metro-message">
          Couldn’t load the timetable.{' '}
          <button type="button" className="link-button" onClick={() => refetch()}>
            Try again
          </button>
        </p>
      )}
      {network && !station && <p className="metro-message">There’s no station “{stationId}”.</p>}

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

          {station.lines.map((l) => {
            const towards = oneWayTowards(network.lines[l], station.index)
            return (
              towards !== null && (
                <p key={l} className="metro-scheduled">
                  {network.lines[l].id} stops here only towards {network.stations[towards].name}; the other way it takes
                  another street.
                </p>
              )
            )
          })}

          {groups.length === 0 && (
            <p className="metro-message">No {station.mode === 'tram' ? 'trams' : 'trains'} are scheduled from here.</p>
          )}

          {groups.map((group) => {
            const line = network.lines[group.line]
            const towards = network.stations[group.towards]
            const headingId = `towards-${line.id}-${towards.id}`
            return (
              <section key={headingId} className="metro-direction" aria-labelledby={headingId}>
                <h2 id={headingId}>
                  <MetroLineBadge line={line} />
                  <span>
                    towards {towards.name}
                    <span className="metro-direction-en">{towards.nameEn}</span>
                  </span>
                </h2>
                <ul className="metro-departures">
                  {group.departures.map((d) => (
                    <li key={d.key} className="metro-departure">
                      <span className="metro-departure-time">{timeFormat.format(d.time)}</span>
                      {/* Every train says where it ends; one ending before the end of the line stands out */}
                      <span className={d.destination === group.towards ? 'metro-departure-dest' : 'metro-departure-dest metro-departure-short'}>
                        to {network.stations[d.destination].name}
                      </span>
                      <span className="metro-departure-in">{inLabel(d, now)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}

          {nearby.length > 0 && (
            <section className="metro-nearby" aria-labelledby="change-nearby">
              <h2 id="change-nearby">{station.mode === 'tram' ? 'Metro nearby' : 'Tram nearby'}</h2>
              <ul>
                {nearby.map(({ other, metres }) => (
                  <li key={other.id}>
                    <Link to={`/rail/station/${other.id}`}>
                      {other.lines.map((l) => (
                        <MetroLineBadge key={l} line={network.lines[l]} />
                      ))}
                      <span className="metro-nearby-name">{other.name}</span>
                      <span className="metro-nearby-distance">{formatDistance(metres)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <MetroCredit />
        </>
      )}
    </section>
  )
}

/** The other mode's stations within walking distance, closest first */
function changeNearby(network: MetroNetwork, station: MetroStation): { other: MetroStation; metres: number }[] {
  return network.stations
    .filter((s) => s.mode !== station.mode)
    .map((other) => ({ other, metres: distanceInMeters(station, other) }))
    .filter((n) => n.metres <= CHANGE_WITHIN_M)
    .sort((a, b) => a.metres - b.metres)
    .slice(0, 3)
}

/** "~4 min": trains run to headways and drift from the timetable, so whole minutes at best */
function inLabel(d: Departure, now: number): string {
  const minutes = Math.round((d.time - now) / 60_000)
  if (minutes <= 0) return 'now'
  if (minutes < 60) return `~${minutes} min`
  return ''
}
