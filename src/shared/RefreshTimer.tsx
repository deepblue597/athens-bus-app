import { useEffect, useState } from 'react'
import './RefreshTimer.css'

interface RefreshTimerProps {
  /** How often the data refreshes on its own */
  intervalMs: number
  /** When the data was last fetched (epoch ms, 0 when never) */
  updatedAt: number
  isFetching: boolean
  onRefresh: () => void
  /** What refreshing does, for screen readers: "Refresh arrivals" */
  label: string
}

/**
 * A ring that empties until the next automatic refresh, with the seconds left inside.
 * Tapping it refreshes right away.
 */
export function RefreshTimer({ intervalMs, updatedAt, isFetching, onRefresh, label }: RefreshTimerProps) {
  const [now, setNow] = useState(0)
  useEffect(() => {
    const tick = () => setNow(Date.now())
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const remainingMs = updatedAt > 0 && now > 0 ? Math.min(intervalMs, Math.max(0, updatedAt + intervalMs - now)) : intervalMs
  const seconds = Math.ceil(remainingMs / 1000)
  // pathLength="100" makes the dash offset a percentage of the circle
  const emptied = 100 - (remainingMs / intervalMs) * 100

  return (
    // Not disabled while fetching: disabling would drop keyboard focus
    <button
      type="button"
      className={isFetching ? 'refresh-timer refresh-timer--busy' : 'refresh-timer'}
      onClick={onRefresh}
      aria-busy={isFetching}
      aria-label={`${label}. Updates on its own every ${intervalMs / 1000} seconds`}
      title={isFetching ? 'Refreshing…' : `Next update in ${seconds} s. Tap to refresh now`}
    >
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <circle className="refresh-timer-track" cx="18" cy="18" r="15" />
        <circle className="refresh-timer-progress" cx="18" cy="18" r="15" pathLength="100" strokeDashoffset={isFetching ? 70 : emptied} />
      </svg>
      <span className="refresh-timer-seconds" aria-hidden="true">
        {isFetching ? '' : seconds}
      </span>
    </button>
  )
}
