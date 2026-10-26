import type { MetroMode } from './metroFile'
import type { LngLat } from './polyline'

export type { MetroMode }

export interface MetroTrack {
  path: LngLat[]
  /** Metres from the path's start to each of its points */
  cumulative: number[]
  /** Station index → metres along the path */
  stationMetres: Map<number, number>
  /** The stations at the path's two ends */
  first: number
  last: number
}

export interface MetroLine {
  index: number
  /** "M1" … "M3", "T6", "T7", and the Proastiakos's "A1" … "A4" */
  id: string
  mode: MetroMode
  color: string
  /** For text on `color` */
  textColor: string
  /** Station indexes as listed, from one end to the other */
  stations: number[]
  /** One track for a metro line; one per direction for a tram line */
  tracks: MetroTrack[]
  /** Station index → the line ends trains leave it towards (one, at a one-way stop or a terminus) */
  departsTowards: Map<number, number[]>
}

export interface MetroStation {
  index: number
  /** Used in URLs, e.g. "syntagma" */
  id: string
  name: string
  nameEn: string
  /** A metro station, a tram stop or a Proastiakos station */
  mode: MetroMode
  lat: number
  lng: number
  /** Indexes of the lines calling here */
  lines: number[]
  /** A Proastiakos station's live departures board at OSE */
  board: number | null
}

export interface MetroPattern {
  line: number
  /** Index into the line's tracks */
  track: number
  stations: number[]
  /** Metres along the track's path for each station */
  metres: number[]
  /** The end of the line this trip heads for (its own last stop may come before it) */
  towards: number
  /** Seconds from the trip's start: [arrival, departure] at each station, flattened */
  times: number[]
}

export interface MetroNetwork {
  /** First and last service date STASY's timetable covers (the Proastiakos's runs on the same dates), YYYY-MM-DD */
  firstDate: string
  lastDate: string
  lines: MetroLine[]
  stations: MetroStation[]
  stationById: Map<string, MetroStation>
  patterns: MetroPattern[]
  /** Each day timetable: [patternIndex, startSeconds, ...] sorted by start */
  plans: number[][]
  /** Service date → index into `plans` */
  days: Record<string, number>
}

/** Where a train probably is now, worked out from the timetable */
export interface TrainEstimate {
  /** Stable while the trip runs, for the map */
  key: string
  line: number
  lng: number
  lat: number
  /** The last station it called at (or is at) and the next one */
  from: number
  to: number
  atStation: boolean
  destination: number
}

export interface Departure {
  key: string
  line: number
  destination: number
  /** Epoch ms */
  time: number
}

/** The next trains from a station on one line in one direction */
export interface DepartureGroup {
  line: number
  /** The end of the line in this direction */
  towards: number
  departures: Departure[]
}
