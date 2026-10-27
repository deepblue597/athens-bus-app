import { describe, expect, it } from 'vitest'
import { athensTimeToEpoch } from '../../domain/time'
import { expectedTime } from '../../domain/stationBoard'
import { OseError, toStationBoard } from './boardAdapters'
import neratziotissa from './__fixtures__/board-18-neratziotissa.json'
import airport from './__fixtures__/board-28-aerodromio.json'
import athina from './__fixtures__/board-1-athina.json'

// Neratziotissa's and the airport's boards were fetched at 00:27 on Tuesday 27 Oct 2026, Athens time;
// Athens's at 10:49, with a cancelled train to Thessaloniki and one arriving from there
const at = (h: number, m: number) => athensTimeToEpoch(2026, 10, 27, h, m)

describe('toStationBoard', () => {
  it('reads the next trains with their departure, platform and delay', () => {
    const board = toStationBoard(neratziotissa)
    expect(board.trains).toHaveLength(5)
    expect(board.trains[0]).toEqual({
      train: '3200',
      operator: 'HELLENIC TRAIN',
      origin: 'Ρέντης',
      originEn: 'Rentis',
      destination: 'Αεροδρόμιο',
      destinationEn: 'Airport',
      platform: '1',
      // Arrives 4:33, leaves 4:34
      scheduled: at(4, 34),
      delayMinutes: 0,
      terminates: false,
      cancelled: false,
      remark: null,
    })
    expect(board.notices).toEqual([])
  })

  it('takes the arrival for a train ending at the station', () => {
    const board = toStationBoard(airport)
    expect(board.trains.map((t) => [t.train, t.terminates])).toEqual([
      ['3200', true],
      ['2201', false],
      ['1200', true],
      ['1203', false],
      ['3202', true],
    ])
    expect(board.trains[0].scheduled).toBe(at(4, 58))
    expect(board.trains[3].destinationEn).toBe('Piraeus Suburban')
  })

  it('reads long-distance trains, a cancellation and an arrival at Athens', () => {
    const board = toStationBoard(athina)
    expect(board.trains.map((t) => [t.train, t.destinationEn, t.terminates, t.cancelled, t.delayMinutes])).toEqual([
      ['52', 'Thessaloniki Gare Centrale', false, true, 0],
      ['1212', 'Airport', false, false, 0],
      ['51', 'Athens', true, false, 9],
      ['1213', 'Piraeus Suburban', false, false, 2],
      ['1542', 'Chalkida', false, false, 0],
    ])
    // The cancellation is cut from the destination, in both languages
    expect(board.trains[0]).toMatchObject({ destination: 'Θεσσαλονίκη Επιβατικός', remark: null, scheduled: at(10, 58) })
    expect(board.trains[2]).toMatchObject({ origin: 'Θεσσαλονίκη Επιβατικός', originEn: 'Thessaloniki Gare Centrale', scheduled: at(11, 4) })
  })

  it('keeps a remark it doesn’t know, and a name’s own parenthesis', () => {
    const route = structuredClone(neratziotissa.routes[0])
    route.routesEl.FROMTO = 'Ρέντης - Αεροδρόμιο (ΜΕΡΙΚΗ ΚΑΤΑΡΓΗΣΗ)'
    expect(toStationBoard({ routes: [route] }).trains[0]).toMatchObject({ destination: 'Αεροδρόμιο', cancelled: false, remark: 'ΜΕΡΙΚΗ ΚΑΤΑΡΓΗΣΗ' })
    route.routesEl.FROMTO = 'Ρέντης - Αθήνα (Σταθμός Λαρίσης)'
    expect(toStationBoard({ routes: [route] }).trains[0]).toMatchObject({ destination: 'Αθήνα (Σταθμός Λαρίσης)', remark: null })
  })

  it('adds the reported delay, reads notices and leaves out unannounced platforms', () => {
    const route = structuredClone(neratziotissa.routes[0])
    route.routesEl.PREVIOUSDELAY9 = '7'
    route.routesEl.DR_PLATFORM = '-'
    const board = toStationBoard({ routes: [route], announcements: [{ id: 1, text: ' Απεργία την Πέμπτη ' }, { id: 2 }] })
    expect(board.trains[0]).toMatchObject({ delayMinutes: 7, platform: null })
    expect(expectedTime(board.trains[0])).toBe(at(4, 41))
    expect(board.notices).toEqual(['Απεργία την Πέμπτη'])
  })

  it('dates a time by the train’s forecast, across midnight', () => {
    const route = structuredClone(neratziotissa.routes[0])
    route.routesEl.DR_TANA = '23:58'
    // 00:03 Athens time on the 28th
    route.routesEl.DR_FORECASTED_DATE = '2026-10-27T22:03:00Z'
    expect(toStationBoard({ routes: [route] }).trains[0].scheduled).toBe(at(23, 58))
  })

  it('has no trains when the board is empty, and fails on a format it can’t read', () => {
    expect(toStationBoard({ routes: [], announcements: [] }).trains).toEqual([])
    expect(() => toStationBoard({ error: 'x' })).toThrow(OseError)
    expect(() => toStationBoard({ routes: [{ routesEl: { TRENO: '1' } }] })).toThrow('format')
  })
})
