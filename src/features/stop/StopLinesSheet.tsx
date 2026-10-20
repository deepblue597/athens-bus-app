import { useRef } from 'react'
import { Link } from 'react-router'
import type { Stop, StopRoute } from '../../domain/types'
import { routeState } from './routeState'
import './StopLinesSheet.css'

interface StopLinesSheetProps {
  routes: StopRoute[]
  stopCode: string
  stop: Stop | undefined
}

/** A "Lines" button that opens a sheet listing every line serving the stop */
export function StopLinesSheet({ routes, stopCode, stop }: StopLinesSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const lines = distinctLines(routes)
  const close = () => dialogRef.current?.close()
  // Where the press started: dragging from inside the sheet onto the backdrop must not close it
  const pressTarget = useRef<EventTarget | null>(null)

  return (
    <>
      <button
        type="button"
        className="stop-lines-button"
        aria-haspopup="dialog"
        onClick={() => dialogRef.current?.showModal()}
      >
        Lines<span className="visually-hidden"> at this stop:</span>{' '}
        <span className="stop-lines-count">{lines.length}</span>
      </button>

      {/* Native modal dialog: traps focus, closes on Esc, and returns focus to the button */}
      <dialog
        ref={dialogRef}
        className="sheet"
        aria-labelledby="stop-lines-heading"
        // A click on the backdrop lands on the dialog element itself
        onPointerDown={(e) => (pressTarget.current = e.target)}
        onClick={(e) => e.target === e.currentTarget && pressTarget.current === e.currentTarget && close()}
      >
        <div className="sheet-content">
          <div className="sheet-header">
            <h2 id="stop-lines-heading">Lines at this stop</h2>
            <button type="button" className="sheet-close" aria-label="Close" onClick={close}>
              <span aria-hidden="true">×</span>
            </button>
          </div>
          <ul className="sheet-list">
            {lines.map((r) => (
              <li key={r.routeCode} className="sheet-line">
                <Link
                  to={`/route/${r.routeCode}`}
                  state={routeState(r, stopCode, stop)}
                  className="sheet-line-route"
                  aria-label={`Line ${r.lineId}, ${r.routeName}. Show route on map`}
                >
                  <span className="line-badge">{r.lineId}</span>
                  <span className="sheet-line-name">{r.routeName}</span>
                </Link>
                <Link
                  to={`/line/${r.lineCode}`}
                  state={{ lineHint: { id: r.lineId, name: r.lineName } }}
                  className="sheet-line-timetable"
                  aria-label={`Line ${r.lineId} timetable`}
                >
                  Timetable
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </dialog>
    </>
  )
}

/**
 * Some lines have several variants of the same direction with identical names (e.g. 227 at Omonoia);
 * list each line and direction once. Arrivals still link to the exact variant a bus is driving.
 */
function distinctLines(routes: StopRoute[]): StopRoute[] {
  const seen = new Set<string>()
  return [...routes]
    .sort((a, b) => a.lineId.localeCompare(b.lineId, 'el', { numeric: true }))
    .filter((r) => {
      const key = `${r.lineId}|${r.routeName}`
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
}
