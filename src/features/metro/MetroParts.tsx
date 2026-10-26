import type { MetroLine, MetroMode, MetroNetwork } from '../../domain/metro'
import { timetableNotice } from '../../domain/trainPositions'
// The badges are also used on the Nearby tab
import './Metro.css'

export function MetroLineBadge({ line }: { line: MetroLine }) {
  return (
    <span className="metro-badge" style={{ background: line.color, color: line.textColor }}>
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

export const STASY_DATA_URL = 'https://data.gov.gr/dataset/dromologia-statheron-sygkoinonion-metro-isap-tram'
export const HELLENIC_TRAIN_TIMETABLE_URL = 'https://www.hellenictrain.gr/proastiakes-grammes-athinas/'
export const OSE_LIVE_URL = 'https://www.hellenictrain.gr/eksypiretisi-epivaton/katastasi-kykloforias/live-plirofories-dromologion/'

/** Where the data on the page comes from: STASY's timetable, and Hellenic Train's and OSE's for the Proastiakos */
export function MetroCredit({ modes = ['metro', 'tram', 'suburban'] }: { modes?: MetroMode[] }) {
  const stasy = modes.includes('metro') || modes.includes('tram')
  const suburban = modes.includes('suburban')
  return (
    <p className="metro-credit">
      {stasy && (
        <>
          Metro and tram timetable:{' '}
          <a href={STASY_DATA_URL} target="_blank" rel="noopener noreferrer">
            STASY via data.gov.gr
          </a>
          .{' '}
        </>
      )}
      {suburban && (
        <>
          Proastiakos timetable:{' '}
          <a href={HELLENIC_TRAIN_TIMETABLE_URL} target="_blank" rel="noopener noreferrer">
            Hellenic Train
          </a>
          ; live departures:{' '}
          <a href={OSE_LIVE_URL} target="_blank" rel="noopener noreferrer">
            OSE’s station screens
          </a>
          .{' '}
        </>
      )}
      Line maps © OpenStreetMap contributors.
    </p>
  )
}
