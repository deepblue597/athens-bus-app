// Format of public/data/metro.json, shared with scripts/build-metro.ts (so no imports here:
// the script runs in Node, which needs explicit file extensions)

/** Bump when the format changes: apps then ignore a file they can't read and use their built-in copy */
export const METRO_FILE_VERSION = 3

/**
 * The rail network and its timetable: STASY's metro and tram from its GTFS feed, and Hellenic Train's
 * Proastiakos from its timetable PDFs (scripts/proastiakos-timetable.json). Each day's trips are
 * stored as (pattern, start time) pairs: a line has only a few dozen distinct stop sequences and
 * timings, and many days share the same timetable, so this keeps a month and a half of trips small.
 */
export interface MetroFile {
  version: typeof METRO_FILE_VERSION
  /** First and last service date the timetable covers, YYYY-MM-DD */
  firstDate: string
  lastDate: string
  lines: MetroFileLine[]
  stations: MetroFileStation[]
  patterns: MetroFilePattern[]
  /** Distinct day timetables: [patternIndex, startSeconds, patternIndex, startSeconds, ...] sorted by start */
  plans: number[][]
  /** Service date (YYYY-MM-DD) → index into `plans` */
  days: Record<string, number>
}

/** "suburban" is the Proastiakos, Hellenic Train's suburban railway */
export type MetroMode = 'metro' | 'tram' | 'suburban'

export interface MetroFileLine {
  /** "M1" … "M3", "T6", "T7", "A1" … "A4" */
  id: string
  mode: MetroMode
  color: string
  /** Text on the line's colour: white, or dark on the Proastiakos's yellow, light green and cyan */
  textColor: string
  /** The line's stations in list order, from one end to the other (one-way stops included) */
  stations: number[]
  /**
   * Track geometry. A metro line has one track for both directions; a tram line one per direction,
   * since they part in places (T7 loops one way through Piraeus).
   */
  tracks: MetroFileTrack[]
}

export interface MetroFileTrack {
  /** [lng, lat] from one end to the other */
  path: [number, number][]
  /** The stations on this track in path order: [stationIndex, metres along the path] */
  stops: [number, number][]
}

/**
 * [id (used in URLs), name, English name, lat, lng], and for a Proastiakos station the number of its
 * live departures board at OSE (ose.mpass.ltd)
 */
export type MetroFileStation = [string, string, string, number, number] | [string, string, string, number, number, number]

export interface MetroFilePattern {
  /** Index into `lines` */
  line: number
  /** Index into the line's `tracks`: the one this trip runs along */
  track: number
  /** Station indexes in the order the train calls */
  stations: number[]
  /** Seconds from the trip's start: [arrival, departure] at each station, flattened */
  times: number[]
}
