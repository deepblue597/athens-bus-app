// Format of public/data/metro.json, shared with scripts/build-metro.ts (so no imports here:
// the script runs in Node, which needs explicit file extensions)

/**
 * The metro network and its timetable, built from STASY's GTFS feed. Each day's trips are stored as
 * (pattern, start time) pairs: a line has only a few dozen distinct stop sequences and timings, and
 * many days share the same timetable, so this keeps a month and a half of trips to a few hundred KB.
 */
export interface MetroFile {
  version: 1
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

export interface MetroFileLine {
  /** "M1", "M2", "M3" */
  id: string
  color: string
  /** Track geometry from one end to the other, [lng, lat] */
  path: [number, number][]
  /** The line's stations in path order: [stationIndex, metres along the path] */
  stops: [number, number][]
}

/** [id (used in URLs), name, English name, lat, lng] */
export type MetroFileStation = [string, string, string, number, number]

export interface MetroFilePattern {
  /** Index into `lines` */
  line: number
  /** Station indexes in the order the train calls */
  stations: number[]
  /** Seconds from the trip's start: [arrival, departure] at each station, flattened */
  times: number[]
}
