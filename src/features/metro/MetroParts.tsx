import type { MetroLine, MetroNetwork } from '../../domain/metro'
import { timetableNotice } from '../../domain/trainPositions'

export function MetroLineBadge({ line }: { line: MetroLine }) {
  return (
    <span className="metro-badge" style={{ background: line.color }}>
      {line.id}
    </span>
  )
}

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const weekdayFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' })
const formatDate = (date: string, format = dateFormat) => format.format(new Date(`${date}T00:00:00Z`))

/** Shown when today is outside the dates STASY published, so another day's timetable stands in */
export function TimetableNotice({ network, now }: { network: MetroNetwork; now: number }) {
  const notice = timetableNotice(network, now)
  if (!notice) {
    return null
  }
  return (
    <p className="metro-notice">
      STASY’s published timetable covers {formatDate(notice.firstDate)} – {formatDate(notice.lastDate)}. Times
      shown follow {formatDate(notice.standIn, weekdayFormat)}’s and may be off, especially on holidays.
    </p>
  )
}

export function MetroCredit() {
  return (
    <p className="metro-credit">
      Timetable:{' '}
      <a href="https://data.gov.gr/dataset/dromologia-statheron-sygkoinonion-metro-isap-tram" target="_blank" rel="noopener noreferrer">
        STASY via data.gov.gr
      </a>
      . Line maps © OpenStreetMap contributors.
    </p>
  )
}
