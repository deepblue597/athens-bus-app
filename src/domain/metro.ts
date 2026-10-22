import type { LngLat } from './polyline'

export interface MetroLine {
  index: number
  /** "M1", "M2", "M3" */
  id: string
  color: string
  path: LngLat[]
  /** Metres from the path's start to each of its points */
  cumulative: number[]
  /** Station indexes in path order */
  stations: number[]
  /** Station index → metres along the path */
  stationMetres: Map<number, number>
}

export interface MetroStation {
  index: number
  /** Used in URLs, e.g. "syntagma" */
  id: string
  name: string
  nameEn: string
  lat: number
  lng: number
  /** Indexes of the lines calling here */
  lines: number[]
}

export interface MetroPattern {
  line: number
  stations: number[]
  /** Metres along the line's path for each station */
  metres: number[]
  /** Seconds from the trip's start: [arrival, departure] at each station, flattened */
  times: number[]
}

export interface MetroNetwork {
  /** First and last service date STASY's timetable covers, YYYY-MM-DD */
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
