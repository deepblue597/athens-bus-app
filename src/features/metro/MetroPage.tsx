import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { estimateTrains } from '../../domain/trainPositions'
import { useNow } from '../../shared/useNow'
import { MetroMap } from './MetroMap'
import { MetroCredit, MetroLineBadge, TimetableNotice } from './MetroParts'
import { useMetroNetwork } from './useMetroNetwork'
import './Metro.css'

/** Trains move ~30 m in 2 s: smooth enough at city zoom, and cheap */
const TRAIN_REFRESH_MS = 2_000

export function MetroPage() {
  const navigate = useNavigate()
  const { data: network, isPending, isError, refetch } = useMetroNetwork()
  const now = useNow(TRAIN_REFRESH_MS)
  const trains = useMemo(() => (network ? estimateTrains(network, now) : []), [network, now])

  return (
    <div className="metro">
      <title>Metro · Athens Bus</title>

      {/* The station list comes first so keyboard and screen reader users reach it before the map */}
      <section className="metro-panel" aria-labelledby="metro-heading">
        <div className="metro-intro">
          <h1 id="metro-heading">Metro</h1>
          <p>
            Train positions are <strong>estimated from STASY’s timetable</strong>, not tracked live. Pick a station for
            its next trains.
          </p>
          {network && <TimetableNotice network={network} now={now} />}
        </div>

        {isPending && <p className="metro-message">Loading the metro timetable…</p>}
        {isError && (
          <p className="metro-message">
            Couldn’t load the metro timetable.{' '}
            <button type="button" className="link-button" onClick={() => refetch()}>
              Try again
            </button>
          </p>
        )}

        {network?.lines.map((line) => {
          const first = network.stations[line.stations[0]]
          const last = network.stations[line.stations[line.stations.length - 1]]
          const running = trains.filter((t) => t.line === line.index).length
          return (
            <details key={line.id} className="metro-line">
              <summary>
                <MetroLineBadge line={line} />
                <span className="metro-line-name">
                  {first.name} – {last.name}
                  <span className="metro-line-sub">
                    {line.stations.length} stations · {running === 0 ? 'no trains now' : `~${running} trains running`}
                  </span>
                </span>
              </summary>
              <ul className="metro-station-list">
                {line.stations.map((index) => {
                  const station = network.stations[index]
                  return (
                    <li key={station.id}>
                      <Link to={`/metro/station/${station.id}`} className="metro-station-item">
                        <span className="metro-station-dot" style={{ borderColor: line.color }} aria-hidden="true" />
                        <span className="metro-station-name">
                          {station.name}
                          <span className="metro-station-name-en">{station.nameEn}</span>
                        </span>
                        {station.lines.length > 1 && (
                          <span className="metro-station-lines">
                            <span className="visually-hidden">Change for</span>
                            {station.lines
                              .filter((l) => l !== line.index)
                              .map((l) => (
                                <MetroLineBadge key={l} line={network.lines[l]} />
                              ))}
                          </span>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </details>
          )
        })}

        {network && <MetroCredit />}
      </section>

      <div className="metro-map">
        {network && (
          <MetroMap network={network} trains={trains} onSelectStation={(s) => navigate(`/metro/station/${s.id}`)} />
        )}
        <p className="metro-legend" aria-hidden="true">
          <span className="metro-legend-train" /> Estimated position, from the timetable
        </p>
      </div>
    </div>
  )
}
