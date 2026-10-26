import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { estimateTrains, oneWayTowards } from '../../domain/trainPositions'
import { useNow } from '../../shared/useNow'
import { MetroMap } from './MetroMap'
import { MetroCredit, MetroLineBadge, TimetableNotice } from './MetroParts'
import { RailNewsList } from './RailNews'
import { useMetroNetwork } from './useMetroNetwork'
import './Metro.css'

/** Trains move ~30 m in 2 s: smooth enough at city zoom, and cheap */
const TRAIN_REFRESH_MS = 2_000

const MODES = [
  { mode: 'metro', heading: 'Metro', stations: 'stations', vehicles: 'trains' },
  { mode: 'tram', heading: 'Tram', stations: 'stops', vehicles: 'trams' },
  { mode: 'suburban', heading: 'Proastiakos', stations: 'stations', vehicles: 'trains' },
] as const

export function MetroPage() {
  const navigate = useNavigate()
  const { data: network, isPending, isError, refetch } = useMetroNetwork()
  const now = useNow(TRAIN_REFRESH_MS)
  const trains = useMemo(() => (network ? estimateTrains(network, now) : []), [network, now])

  return (
    <div className="metro">
      <title>Rail · Athens Bus</title>

      {/* The station list comes first so keyboard and screen reader users reach it before the map */}
      <section className="metro-panel" aria-labelledby="metro-heading">
        <div className="metro-intro">
          <h1 id="metro-heading">Rail</h1>
          <p>
            Train and tram positions are <strong>estimated from the timetables</strong>, not tracked live. Pick a
            station for its next departures; Proastiakos stations also show OSE’s live departures.
          </p>
          {network && <TimetableNotice network={network} now={now} />}
        </div>

        {network && <RailNewsList network={network} now={now} />}

        {isPending && <p className="metro-message">Loading the timetable…</p>}
        {isError && (
          <p className="metro-message">
            Couldn’t load the timetable.{' '}
            <button type="button" className="link-button" onClick={() => refetch()}>
              Try again
            </button>
          </p>
        )}

        {network &&
          MODES.map(({ mode, heading, stations: stationsWord, vehicles }) => {
            const lines = network.lines.filter((l) => l.mode === mode)
            if (lines.length === 0) {
              return null
            }
            return (
              <section key={mode} aria-labelledby={`rail-${mode}`}>
                <h2 id={`rail-${mode}`} className="metro-mode-heading">
                  {heading}
                </h2>
                {lines.map((line) => {
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
                            {line.stations.length} {stationsWord} ·{' '}
                            {running === 0 ? `no ${vehicles} now` : `~${running} ${vehicles} running`}
                          </span>
                        </span>
                      </summary>
                      <ul className="metro-station-list">
                        {line.stations.map((index) => {
                          const station = network.stations[index]
                          const oneWay = oneWayTowards(line, index)
                          return (
                            <li key={station.id}>
                              <Link to={`/rail/station/${station.id}`} className="metro-station-item">
                                <span className="metro-station-dot" style={{ borderColor: line.color }} aria-hidden="true" />
                                <span className="metro-station-name">
                                  {station.name}
                                  <span className="metro-station-name-en">{station.nameEn}</span>
                                  {oneWay !== null && (
                                    <span className="metro-station-oneway">towards {network.stations[oneWay].name} only</span>
                                  )}
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
              </section>
            )
          })}

        {network && <MetroCredit />}
      </section>

      <div className="metro-map">
        {network && (
          <MetroMap network={network} trains={trains} onSelectStation={(s) => navigate(`/rail/station/${s.id}`)} />
        )}
        <p className="metro-legend" aria-hidden="true">
          <span className="metro-legend-train" /> Estimated position, from the timetable
        </p>
      </div>
    </div>
  )
}

