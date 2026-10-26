import type { StationBoard } from '../../domain/stationBoard'
import { getJson, isNativeApp } from '../oasa/client'
import { toStationBoard } from './boardAdapters'
import { BOARD_ID_PATTERN, OSE_ORIGIN, boardPath } from './boardQuery'

// Like OASA's APIs (see client.ts), the Android app asks OSE directly through native HTTP. The website
// could too (OSE allows any origin), but goes through the Worker (worker/oseProxy.ts) so that everyone
// watching a station costs OSE one request every 30 seconds.
const boardUrl = (board: number) => (isNativeApp ? OSE_ORIGIN + boardPath(board) : `/ose/screens/${board}`)

const TIMEOUT_MS = 8000

/** A Proastiakos station's live departures board */
export async function fetchStationBoard(board: number): Promise<StationBoard> {
  if (!BOARD_ID_PATTERN.test(String(board))) {
    throw new Error(`Not a station board: ${board}`)
  }
  return toStationBoard(await getJson(boardUrl(board), TIMEOUT_MS))
}
