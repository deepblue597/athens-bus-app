import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import type { Departure, DepartureGroup, MetroNetwork, MetroStation } from '../../domain/metro'
import { athensDate } from '../../domain/time'
import { addDays, dayTimetable } from '../../domain/trainPositions'
import { Segmented } from '../../shared/Segmented'
import { useNow } from '../../shared/useNow'
import { MetroCredit, MetroLineBadge, StandInNotice } from './MetroParts'
import { directionKey } from './timetablePath'
import { useMetroNetwork } from './useMetroNetwork'
import './Metro.css'

// A station's whole day of scheduled departures, a week ahead: planning a trip hours before (the
// airport train), where the station page only has the next few. The URL holds the day, direction and
// destination, so a timetable can be shared and the back button returns to it.

const REFRESH_MS = 30_000
/** Today and the six days after it */
const DAYS_SHOWN = 7
/** Departures already this far in the past still count as the next one, as on the station page */
const JUST_LEFT_MS = 30_000
const ALL = 'all'

const timeFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Athens' })
const dayFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', timeZone: 'UTC' })
const longDayFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
const atMidnight = (date: string) => new Date(`${date}T00:00:00Z`)

export function MetroTimetablePage() {
  const { stationId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const { data: network, isPending, isError, refetch } = useMetroNetwork()
  const now = useNow(REFRESH_MS)
  const today = athensDate(now)
  const day = isDate(params.get('day')) ? params.get('day')! : today
  const station = network?.stationById.get(stationId)
  const timetable = useMemo(
    () => (network && station ? dayTimetable(network, station.index, day) : null),
    [network, station, day],
  )
  // "Show earlier" is for one view: another day or direction starts at the next train again
  const [pastShownFor, setPastShownFor] = useState<string | null>(null)

  const setParam = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key)
      else next.set(key, value)
    }
    setParams(next, { replace: true })
  }

  const title = station ? `${station.name} timetable` : 'Timetable'
  const backTo = `/rail/station/${stationId}`

  return (
    <section className="metro-station-page">
      <title>{`${title} · Rail · Athens Bus`}</title>

      <Link to={backTo} className="metro-back">
        <span aria-hidden="true">←</span> {station?.name ?? 'Station'}
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

      {network && station && timetable && (
        <>
          <header className="metro-station-header">
            <h1>{station.name}</h1>
            <p className="metro-station-subtitle">
              {station.nameEn} · full timetable
              {station.lines.map((l) => (
                <MetroLineBadge key={l} line={network.lines[l]} />
              ))}
            </p>
          </header>

          <div className="metro-tt-controls">
            <Segmented
              label="Day"
              value={day}
              options={dayOptions(today, day)}
              onChange={(value) => setParam({ day: value === today ? null : value })}
            />
          </div>

          {timetable.standIn !== null && <StandInNotice network={network} standIn={timetable.standIn} />}

          <DayView
            network={network}
            station={station}
            groups={timetable.groups}
            day={day}
            isToday={day === today}
            now={now}
            dir={params.get('dir')}
            to={params.get('to')}
            onDirection={(value) => setParam({ dir: value, to: null })}
            onDestination={(value) => setParam({ to: value === ALL ? null : value })}
            pastShownFor={pastShownFor}
            onShowPast={setPastShownFor}
          />

          <MetroCredit modes={[station.mode]} />
        </>
      )}
    </section>
  )
}

interface DayViewProps {
  network: MetroNetwork
  station: MetroStation
  groups: DepartureGroup[]
  day: string
  isToday: boolean
  now: number
  dir: string | null
  to: string | null
  onDirection: (value: string) => void
  onDestination: (value: string) => void
  pastShownFor: string | null
  onShowPast: (view: string | null) => void
}

function DayView({ network, station, groups, day, isToday, now, dir, to, onDirection, onDestination, pastShownFor, onShowPast }: DayViewProps) {
  const vehicles = station.mode === 'tram' ? 'trams' : 'trains'
  if (groups.length === 0) {
    return (
      <p className="metro-message">
        No {vehicles} are scheduled from here on {longDayFormat.format(atMidnight(day))}.
      </p>
    )
  }

  const group = groups.find((g) => directionKey(network, g) === dir) ?? groups[0]
  const line = network.lines[group.line]
  const towards = network.stations[group.towards]

  // Trains ending before the end of the line, e.g. most M3 trains end at Δουκίσσης Πλακεντίας, not the airport.
  // Only the end of the line is worth filtering to: a train to the end also stops where the others end
  const destinations = destinationsOf(group)
  const canFilter = destinations.length > 1 && destinations.includes(group.towards)
  const destination = canFilter && to === towards.id ? group.towards : null
  const departures = destination === null ? group.departures : group.departures.filter((d) => d.destination === destination)
  // Letters mark the trains ending early when all are shown; the end of the line gets none
  const marks = new Map(destination === null ? destinations.filter((d) => d !== group.towards).map((d, i) => [d, String.fromCharCode(97 + i)]) : [])

  const firstUpcoming = isToday ? departures.findIndex((d) => d.time >= now - JUST_LEFT_MS) : 0
  const next = isToday ? firstUpcoming : -1
  const view = `${day}|${directionKey(network, group)}|${destination ?? ALL}`
  // Today's list starts at the next train; earlier ones are one tap away
  const earlier = !isToday ? 0 : firstUpcoming < 0 ? departures.length : firstUpcoming
  const hidden = pastShownFor === view ? 0 : earlier
  const shown = departures.slice(hidden)

  return (
    <>
      {groups.length > 1 && (
        <div className="metro-tt-controls">
          <Segmented
            label="Direction"
            value={directionKey(network, group)}
            options={groups.map((g) => ({
              value: directionKey(network, g),
              label: `${network.lines[g.line].id} → ${network.stations[g.towards].name}`,
            }))}
            onChange={onDirection}
          />
        </div>
      )}

      <h2 className="metro-tt-heading">
        <MetroLineBadge line={line} />
        <span>
          towards {towards.name}
          <span className="metro-direction-en">{towards.nameEn}</span>
        </span>
      </h2>

      {canFilter && (
        <div className="metro-tt-controls">
          <Segmented
            label="Where the train ends"
            value={destination === null ? ALL : towards.id}
            options={[
              { value: ALL, label: `All ${vehicles}` },
              { value: towards.id, label: `Only to ${towards.name}` },
            ]}
            onChange={onDestination}
          />
        </div>
      )}

      <p className="metro-tt-summary" aria-live="polite">
        {departures.length === 0 ? (
          `No ${vehicles} to ${towards.name} on this day.`
        ) : !isToday ? (
          `${departures.length} ${vehicles} on ${longDayFormat.format(atMidnight(day))}`
        ) : next >= 0 ? (
          <>
            Next <strong>{timeFormat.format(departures[next].time)}</strong>
            {inLabel(departures[next].time, now)} · {departures.length - next} more today
          </>
        ) : (
          `No more ${vehicles} today.`
        )}
      </p>

      {marks.size > 0 && (
        <p className="metro-tt-legend">
          {[...marks].map(([d, mark]) => (
            <span key={d}>
              <sup className="metro-tt-mark">{mark}</sup> ends at {network.stations[d].name}
            </span>
          ))}
        </p>
      )}

      {earlier > 0 && (
        <button
          type="button"
          className="link-button metro-tt-earlier"
          aria-expanded={hidden === 0}
          onClick={() => onShowPast(hidden === 0 ? null : view)}
        >
          {hidden === 0 ? 'Hide earlier departures' : `Show ${earlier} earlier ${earlier === 1 ? 'departure' : 'departures'}`}
        </button>
      )}

      {shown.length > 0 && (
        <ol className="metro-tt" aria-label={`Departures towards ${towards.name}`}>
          {byHour(shown).map(([hour, inHour]) => (
            <li key={hour} className="metro-tt-hour">
              <span className="metro-tt-hour-label" aria-hidden="true">
                {hour}
              </span>
              <ol className="metro-tt-times">
                {inHour.map((d) => {
                  const i = departures.indexOf(d)
                  const status = i === next ? ' metro-tt-time--next' : isToday && i < firstUpcoming ? ' metro-tt-time--past' : ''
                  const mark = marks.get(d.destination)
                  return (
                    <li key={d.key} className={`metro-tt-time${status}`}>
                      {i === next && <span className="visually-hidden">Next: </span>}
                      {timeFormat.format(d.time)}
                      {mark && (
                        <>
                          <sup className="metro-tt-mark" aria-hidden="true">
                            {mark}
                          </sup>
                          <span className="visually-hidden">, to {network.stations[d.destination].name}</span>
                        </>
                      )}
                    </li>
                  )
                })}
              </ol>
            </li>
          ))}
        </ol>
      )}

      <p className="metro-scheduled">
        Scheduled times, not live. Trains run to a headway and can be a minute or two off.
      </p>
    </>
  )
}

/** Where a direction's trains end: the end of the line first, then the most frequent */
function destinationsOf(group: DepartureGroup): number[] {
  const counts = new Map<number, number>()
  for (const d of group.departures) {
    counts.set(d.destination, (counts.get(d.destination) ?? 0) + 1)
  }
  return [...counts.keys()].sort(
    (a, b) => Number(b === group.towards) - Number(a === group.towards) || counts.get(b)! - counts.get(a)!,
  )
}

/** Departures in rows per clock hour, "05" to "23" and the small hours of the night before */
function byHour(departures: Departure[]): [string, Departure[]][] {
  const rows: [string, Departure[]][] = []
  for (const d of departures) {
    const hour = timeFormat.format(d.time).slice(0, 2)
    const last = rows[rows.length - 1]
    if (last && last[0] === hour) last[1].push(d)
    else rows.push([hour, [d]])
  }
  return rows
}

function dayOptions(today: string, day: string): { value: string; label: string }[] {
  const dates = Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(today, i))
  // A shared link can name a day outside the week shown
  if (!dates.includes(day)) dates.push(day)
  return dates.map((date) => ({
    value: date,
    label: date === today ? 'Today' : date === addDays(today, 1) ? 'Tomorrow' : dayFormat.format(atMidnight(date)),
  }))
}

function isDate(value: string | null): boolean {
  return value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(atMidnight(value).getTime())
}

function inLabel(time: number, now: number): string {
  const minutes = Math.round((time - now) / 60_000)
  if (minutes <= 0) return ' · now'
  if (minutes < 60) return ` · in ${minutes} min`
  return ''
}
