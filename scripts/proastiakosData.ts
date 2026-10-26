// Pure parts of the Proastiakos timetable conversion (scripts/convert-proastiakos.ts), kept apart so
// they can be tested. Hellenic Train publishes its timetables only as PDFs made in Word, one per line
// (two for A2: weekdays and weekends); `pdftotext -layout` turns each into text tables like:
//
//                                 ΠΕΙΡΑΙΑΣ - ΑΘΗΝΑ - ΑΕΡΟΔΡΟΜΙΟ
//               Αριθμός
//             Δρομολογίου
//                           3200 1200 3202 3204* 1202
//   Πειραιάς/Piraeus         ...   ...     ...   ...    5:43
//   Ταύρος/Tavros            4:03   4:27   4:44   5:05   5:54
//
// "..." (or "…") is a station the train doesn't run to, "|" one it passes without stopping, and some
// times are written 4.41. Long names wrap: their times sit on a line of their own, between the name's
// two halves.

/** Hellenic Train's page linking the timetable PDFs */
export const PROASTIAKOS_PAGE = 'https://www.hellenictrain.gr/proastiakes-grammes-athinas/'

/** The timetable PDFs a page of Hellenic Train's site links to, in page order */
export function timetablePdfs(html: string): string[] {
  const links = [...html.matchAll(/href="(https:\/\/www\.hellenictrain\.gr\/wp-content\/uploads\/[^"]+\.pdf)"/g)].map((m) => m[1])
  return [...new Set(links)]
}

/** Which days a train runs: every day, Monday to Friday, or Saturdays, Sundays and public holidays */
export type ServiceDays = 'daily' | 'weekdays' | 'weekends'

export interface ProastiakosTrip {
  line: string
  /** Hellenic Train's train number, as on the station boards ("1200") */
  train: string
  days: ServiceDays
  /** [station name as the PDF writes it, "H:MM"], hours past 23 after midnight ("24:17") */
  stops: [string, string][]
}

/** Format of scripts/proastiakos-timetable.json */
export interface ProastiakosTimetable {
  _comment?: string
  /** The page listing the PDFs, and the PDFs this was converted from */
  page: string
  pdfs: string[]
  trips: ProastiakosTrip[]
}

const VALUE = String.raw`(?:\d{1,2}[:.]\d\d|\.\.\.|…|\|)`
/** A line ending in one or more values (times, "...", "|"), with any text before them */
const VALUES_ROW = new RegExp(String.raw`^(.*?)(?:^|\s{2,}|\s(?=\d))((?:${VALUE}\s*)+)$`)
const VALUE_TOKEN = new RegExp(VALUE, 'g')
const TRAIN_NUMBER = /^\d{3,5}\*?$/

/** "Τα Δρομολόγια 3201 & 3204 ΔΕΝ κυκλοφορούν Σαββατοκύριακα και αργίες", read without accents */
const NOTE = /δρομολογια(.{0,120}?)\sδεν\s+κυκλοφορ\p{L}*(.{0,60})/giu

const DAY_START_SECONDS = 3 * 3600
const DAY_SECONDS = 24 * 3600

/**
 * The trips in one PDF's text. `line` is the Proastiakos line the PDF is for. Fails on anything it
 * doesn't understand (a row with the wrong number of times, a footnote it can't read), since a wrong
 * guess would put trains in the wrong place.
 */
export function parseTimetableText(text: string, line: string): ProastiakosTrip[] {
  const lines = text.split(/\r?\n/)
  const weekdayOnly = weekdayOnlyTrains(text)
  const trips: ProastiakosTrip[] = []
  const starred = new Set<string>()

  let table: { trains: string[]; days: ServiceDays; columns: [string, number][][] } | null = null
  let title: string[] = []
  let pendingName: string | null = null
  const finishTable = () => {
    if (!table) {
      return
    }
    trips.push(...tableTrips(table.trains, table.columns, table.days, line, weekdayOnly))
    table = null
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const trimmed = raw.trim()
    if (trimmed === '') {
      continue
    }
    // A table starts with "Αριθμός / Δρομολογίου" and then a row of train numbers
    if (/^Αριθμός$/.test(trimmed)) {
      const days = daysOfTitle(title.join(' '))
      finishTable()
      title = []
      const label = lines[i + 1]?.trim()
      const numbers = lines[i + 2]?.trim().split(/\s+/) ?? []
      if (label !== 'Δρομολογίου' || numbers.length === 0 || !numbers.every((n) => TRAIN_NUMBER.test(n))) {
        throw new Error(`Line ${i + 1}: expected "Δρομολογίου" and a row of train numbers after "Αριθμός"`)
      }
      numbers.filter((n) => n.endsWith('*')).forEach((n) => starred.add(n.slice(0, -1)))
      const trains = numbers.map((n) => n.replace('*', ''))
      table = { trains, days, columns: trains.map(() => []) }
      pendingName = null
      i += 2
      continue
    }
    const row = VALUES_ROW.exec(raw)
    if (!table) {
      title.push(trimmed)
      continue
    }
    if (!row) {
      // A line of text: a station whose times come on the next line, the second half of a wrapped
      // name, or the title of the next table
      if (trimmed.includes('/')) {
        pendingName = greekName(trimmed)
      } else if (pendingName === null) {
        title.push(trimmed)
      }
      continue
    }
    const label = row[1].trim()
    const values = row[2].match(VALUE_TOKEN) ?? []
    // "(Σύνδεση με …/" under Οινόη is a note about the station above, not a station
    const name = label && !label.startsWith('(') && label.includes('/') ? greekName(label) : pendingName
    if (!name) {
      throw new Error(`Line ${i + 1}: times without a station name: "${trimmed}"`)
    }
    if (values.length !== table.trains.length) {
      throw new Error(`Line ${i + 1} (${name}): ${values.length} times for ${table.trains.length} trains`)
    }
    values.forEach((value, column) => {
      if (/^\d/.test(value)) {
        table!.columns[column].push([name, clockSeconds(value)])
      }
    })
    pendingName = null
    // A title line straight after a table ends it
    title = []
  }
  finishTable()

  for (const train of starred) {
    if (!weekdayOnly.has(train)) {
      throw new Error(`Train ${train} is marked * but no note says what that means`)
    }
  }
  return trips
}

/** "Πύργος Βασιλίσσης/Pyrgos" → "Πύργος Βασιλίσσης" */
function greekName(label: string): string {
  return label.slice(0, label.indexOf('/')).trim()
}

function daysOfTitle(title: string): ServiceDays {
  // A note above the first table ("… ΔΕΝ κυκλοφορούν Σαββατοκύριακα") isn't the table's days
  const text = plain(title).replace(/\s+/g, ' ').replace(NOTE, '')
  if (/δευτερα\s+(?:εως|-|–)\s+παρασκευη/iu.test(text)) {
    return 'weekdays'
  }
  if (/σαββατο|σαββατοκυριακ/iu.test(text)) {
    return 'weekends'
  }
  return 'daily'
}

/**
 * Trains a note says don't run at weekends ("Τα Δρομολόγια 3201 & 3204 ΔΕΝ κυκλοφορούν
 * Σαββατοκύριακα και αργίες"). Notes wrap over lines, so the text is read as one.
 */
export function weekdayOnlyTrains(text: string): Set<string> {
  // Without accents, so "Δρομολόγια" and "ΔΡΟΜΟΛΟΓΙΑ" read the same (and \b doesn't work for Greek)
  const flat = plain(text).replace(/\s+/g, ' ')
  const trains = new Set<string>()
  const notes = [...flat.matchAll(NOTE)]
  if (notes.length !== (flat.match(/δεν\s+κυκλοφορ/giu) ?? []).length) {
    throw new Error('A "ΔΕΝ κυκλοφορούν" note the converter can’t read')
  }
  for (const [note, numbers, days] of notes) {
    if (!/σαββατ|κυριακ/iu.test(days)) {
      throw new Error(`A note the converter doesn't understand: "${note.trim()}"`)
    }
    for (const n of numbers.match(/\d{3,5}/g) ?? []) {
      trains.add(n)
    }
  }
  return trains
}

/** Without accents */
export function plain(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '')
}

/** "4:03" or "4.41" → seconds */
function clockSeconds(value: string): number {
  const [h, m] = value.split(/[:.]/).map(Number)
  return h * 3600 + m * 60
}

function tableTrips(
  trains: string[],
  columns: [string, number][][],
  days: ServiceDays,
  line: string,
  weekdayOnly: Set<string>,
): ProastiakosTrip[] {
  return trains.map((train, c) => {
    const calls = columns[c]
    if (calls.length < 2) {
      throw new Error(`Train ${train} has ${calls.length} stop(s)`)
    }
    // The service day runs from about 04:00 past midnight: a trip leaving before 03:00 (Χαλκίδα's
    // 0:00) is the night's last, and times keep counting past 24:00 within a trip
    let offset = calls[0][1] < DAY_START_SECONDS ? DAY_SECONDS : 0
    let previous = -1
    const stops = calls.map(([name, seconds]): [string, string] => {
      if (seconds + offset < previous) {
        offset += DAY_SECONDS
      }
      previous = seconds + offset
      return [name, clockText(previous)]
    })
    const runs: ServiceDays = weekdayOnly.has(train) ? (days === 'weekends' ? days : 'weekdays') : days
    return { line, train, days: runs, stops }
  })
}

/** Seconds → "H:MM" (hours may pass 23) */
export function clockText(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}:${String(m).padStart(2, '0')}`
}

/** "24:17" → seconds since the service day's start */
export function parseClock(text: string): number {
  const match = /^(\d{1,2}):(\d\d)$/.exec(text)
  if (!match) {
    throw new Error(`Bad time "${text}"`)
  }
  return Number(match[1]) * 3600 + Number(match[2]) * 60
}
