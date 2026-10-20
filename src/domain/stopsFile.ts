// Format of public/data/stops.json, shared with scripts/build-stops.ts (so no imports here:
// the script runs in Node, which needs explicit file extensions)

/**
 * One stop, as a tuple to keep the file small (~8,000 stops):
 * [code, displayId, name, nameEn, lat, lng, line numbers serving it]
 */
export type StopsFileRow = [string, string, string, string | null, number, number, string[]]

export interface StopsFile {
  version: 1
  stops: StopsFileRow[]
}
