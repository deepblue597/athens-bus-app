// The one OSE request the app makes, shared by the client (src/data/ose/board.ts) and the Worker
// (worker/oseProxy.ts), which rebuilds it from these values instead of forwarding whatever it is sent.
// No imports, so both TypeScript projects can use it.
//
// ose.mpass.ltd is the backend of the departure screens OSE runs at its stations (and on
// delays.osenet.gr), which Hellenic Train's "Live πληροφορίες δρομολογίων" page links to. It needs no
// key and answers any origin (Access-Control-Allow-Origin: *).

export const OSE_ORIGIN = 'https://ose.mpass.ltd'

/** A station's board number, as in scripts/proastiakos-stations.json (Αθήνα is 1, Χαλκίδα 597) */
export const BOARD_ID_PATTERN = /^\d{1,4}$/

/** Path of a station's board, with Greek and English text */
export function boardPath(board: number | string): string {
  return `/api/v1/screens/${board}/data/multilingual`
}
