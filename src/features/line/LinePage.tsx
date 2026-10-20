import { useId, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { timetableSides, type Line } from '../../domain/line'
import type { StopRoute } from '../../domain/types'
import { nextDepartureIndex } from '../../domain/time'
import type { RoutePageState } from '../route/RoutePage'
import { TODAY, useAthensMinutes, useLineDirections, useLines, useScheduleDays, useTimetable } from './useLineData'
import './LinePage.css'

export function LinePage() {
  const { lineCode = '' } = useParams()
  const state = useLocation().state as LinePageState | null
  const lines = useLines()
  const line = state?.line ?? lines.data?.find((l) => l.code === lineCode)
  // Shown while the full line list loads when coming from a stop or route
  const header = line ?? state?.lineHint

  const directions = useLineDirections(lineCode).data ?? []
  const days = useScheduleDays(lineCode).data ?? []
  const [day, setDay] = useState(TODAY)
  const [directionIndex, setDirectionIndex] = useState(0)
  const [showPast, setShowPast] = useState(false)
  const timetable = useTimetable(line, day)
  const now = useAthensMinutes()

  // One tab per direction; single-route lines (circular, part-route variants) get one
  const sides = timetable.data ? timetableSides(directions, timetable.data) : []
  const sideIndex = Math.min(directionIndex, Math.max(sides.length - 1, 0))
  const side = sides[sideIndex]
  const times = side?.times ?? []
  const direction = side?.direction
  const isToday = day === TODAY
  const noServiceToday = isToday && timetable.isSuccess && times.length === 0 && days.length > 0
  const next = isToday ? nextDepartureIndex(times, now) : -1
  // Early in the morning the next bus can be the previous night's late trip, listed after today's
  // daytime departures; those are still to come, so nothing is hidden or greyed out then
  const nextIsLateTrip = next >= 0 && times[next].minutesOfServiceDay - 24 * 60 >= now
  const earlier = next > 0 && !nextIsLateTrip ? next : 0
  // Index of the first departure still to come today; everything before it has left
  const firstUpcoming = !isToday || nextIsLateTrip ? 0 : next >= 0 ? next : times.length
  // Today's timetable starts at the next departure; earlier ones are one tap away
  const hiddenPast = showPast ? 0 : earlier
  const backTo = state?.linesQuery ? `/lines?${new URLSearchParams({ q: state.linesQuery })}` : '/lines'

  if (lines.isSuccess && !line) {
    return (
      <section className="line-page">
        <title>Line not found · Athens Bus</title>
        <BackLink to={backTo} />
        <p className="line-message">There is no line with code “{lineCode}”.</p>
      </section>
    )
  }

  return (
    <section className="line-page">
      <title>{`${header ? `${header.id} ${header.name}` : 'Line'} · Athens Bus`}</title>
      <BackLink to={backTo} />

      <header className="line-header">
        {header && (
          <span className="line-badge" aria-hidden="true">
            {header.id}
          </span>
        )}
        <div>
          <h1>
            {header && <span className="visually-hidden">Line {header.id}: </span>}
            {header?.name ?? 'Loading line…'}
          </h1>
          {line?.nameEn && <p className="line-subtitle">{line.nameEn}</p>}
        </div>
      </header>

      <Segmented
        label="Timetable day"
        value={day}
        options={[{ value: TODAY, label: 'Today' }, ...days.map((d) => ({ value: d.code, label: d.label }))]}
        onChange={(value) => {
          setDay(value)
          setShowPast(false)
        }}
      />

      {sides.length > 1 && (
        <Segmented
          label="Direction"
          value={String(sideIndex)}
          options={sides.map((s, i) => ({
            value: String(i),
            label: `From ${s.direction?.from ?? (i === 0 ? 'first terminal' : 'last terminal')}`,
          }))}
          onChange={(value) => {
            setDirectionIndex(Number(value))
            setShowPast(false)
          }}
        />
      )}

      {direction && line && (
        <Link
          to={`/route/${direction.routeCode}`}
          state={
            {
              route: toStopRoute(line, direction.routeCode, direction.name, direction.nameEn),
              fromLine: { code: line.code, id: line.id, name: line.name },
            } satisfies RoutePageState
          }
          className="line-route-link"
        >
          Show {direction.name} on the map <span aria-hidden="true">›</span>
        </Link>
      )}

      {/* Only the status is live: the "in N min" countdown would otherwise be read out every minute */}
      <p className="line-summary">
        <span aria-live="polite">
          {timetable.isPending && 'Loading timetable…'}
          {timetable.isError && (
            <>
              Couldn’t load the timetable.{' '}
              <button type="button" className="link-button" onClick={() => timetable.refetch()}>
                Try again
              </button>
            </>
          )}
          {noServiceToday && 'No service today.'}
          {timetable.isSuccess && times.length === 0 && !noServiceToday && 'No departures in this timetable.'}
          {times.length > 0 &&
            (!isToday ? (
              `${times.length} ${times.length === 1 ? 'departure' : 'departures'}`
            ) : next >= 0 ? (
              <>
                Next departure <strong>{times[next].label}</strong>
              </>
            ) : (
              'No more departures today.'
            ))}
        </span>
        {next >= 0 && minutesUntil(times[next].minutesOfServiceDay, now)}
      </p>

      {/* Some lines only run on certain days (e.g. Saturday nights) */}
      {noServiceToday && (
        <p className="line-other-days">
          See the timetable for{' '}
          {days.map((d, i) => (
            <span key={d.code}>
              {i > 0 && (i === days.length - 1 ? ' or ' : ', ')}
              <button type="button" className="link-button" onClick={() => setDay(d.code)}>
                {d.label}
              </button>
            </span>
          ))}
          .
        </p>
      )}

      {earlier > 0 && (
        <button
          type="button"
          className="link-button timetable-earlier"
          aria-expanded={showPast}
          onClick={() => setShowPast(!showPast)}
        >
          {showPast ? 'Hide earlier departures' : `Show ${earlier} earlier ${earlier === 1 ? 'departure' : 'departures'}`}
        </button>
      )}

      <ol className="timetable" aria-label="Departure times">
        {times.slice(hiddenPast).map((t, j) => {
          const i = j + hiddenPast
          const modifier = i === next ? ' timetable-time--next' : i < firstUpcoming ? ' timetable-time--past' : ''
          return (
            <li key={t.minutesOfServiceDay} className={`timetable-time${modifier}`}>
              {i === next && <span className="visually-hidden">Next departure: </span>}
              {t.label}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

export interface LinePageState {
  line?: Line
  lineHint?: { id: string; name: string }
  /** The search on the lines page, restored by the back link */
  linesQuery?: string
}

function BackLink({ to }: { to: string }) {
  return (
    <Link to={to} className="line-back">
      <span aria-hidden="true">←</span> Lines
    </Link>
  )
}

interface SegmentedProps {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}

/** A row of pill-shaped radio buttons: one choice, arrow keys move between options */
function Segmented({ label, value, options, onChange }: SegmentedProps) {
  const name = useId()
  return (
    <fieldset className="segmented">
      <legend className="visually-hidden">{label}</legend>
      <div className="segmented-options">
        {options.map((o) => (
          <label key={o.value}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function minutesUntil(minutesOfServiceDay: number, now: number): string {
  // After-midnight trips are numbered from the previous midnight
  let diff = minutesOfServiceDay - now
  if (diff > 20 * 60) diff -= 24 * 60
  if (diff < 0) diff += 24 * 60
  return diff === 0 ? ' · now' : diff < 60 ? ` · in ${diff} min` : ''
}

function toStopRoute(line: Line, routeCode: string, routeName: string, routeNameEn: string | null): StopRoute {
  return { routeCode, lineCode: line.code, lineId: line.id, lineName: line.name, routeName, routeNameEn }
}
