import { describe, expect, it } from 'vitest'
import type { StopsFile, StopsFileRow } from '../src/domain/stopsFile.ts'
import { MIN_STOPS, parseList, shrinkError, toStopsFile, type RawStop } from './stopsData.ts'

// Shaped like webGetStops rows (2026-10-20), including OASA's stray whitespace
const omonoia: RawStop = {
  StopCode: '60134',
  StopID: '060134',
  StopDescr: 'ΠΛ. ΟΜΟΝΟΙΑΣ',
  StopDescrEng: 'PL. OMONOIAS',
  StopLat: '37.9833684',
  StopLng: '23.7279032',
}
const sikelianou: RawStop = {
  StopCode: '10580',
  StopID: '770046    ',
  StopDescr: 'ΣΤ.  ΛΑΡΙΣΗΣ ',
  StopDescrEng: null,
  StopLat: '37.99',
  StopLng: '23.72',
}
const grammatiko: RawStop = { ...omonoia, StopCode: '-2', StopID: '00061', StopLat: '38.202772', StopLng: '23.965918' }

describe('parseList', () => {
  it('accepts lists and OASA’s ways of saying "nothing found"', () => {
    expect(parseList('[{"a":1}]')).toEqual([{ a: 1 }])
    expect(parseList('null')).toEqual([])
    expect(parseList('""')).toEqual([])
  })

  it('rejects errors and non-JSON bodies', () => {
    expect(() => parseList('{"error":"invalid parameters"}')).toThrow(/unexpected response/)
    expect(() => parseList('<!DOCTYPE HTML><title>403 Forbidden</title>')).toThrow()
  })
})

describe('toStopsFile', () => {
  it('merges the lines of a stop across routes, sorted', () => {
    const { file } = toStopsFile([
      { lineId: '400', stops: [omonoia] },
      { lineId: '040', stops: [omonoia, grammatiko] },
      { lineId: 'Α1', stops: [omonoia] },
      { lineId: '040', stops: [omonoia] },
    ])
    expect(file.stops).toEqual([
      ['-2', '00061', 'ΠΛ. ΟΜΟΝΟΙΑΣ', 'PL. OMONOIAS', 38.202772, 23.965918, ['040']],
      ['60134', '060134', 'ΠΛ. ΟΜΟΝΟΙΑΣ', 'PL. OMONOIAS', 37.983368, 23.727903, ['040', '400', 'Α1']],
    ])
  })

  it('trims and collapses whitespace, and stores missing English names as null', () => {
    const { file } = toStopsFile([{ lineId: ' 035 ', stops: [sikelianou] }])
    expect(file.stops[0]).toEqual(['10580', '770046', 'ΣΤ. ΛΑΡΙΣΗΣ', null, 37.99, 23.72, ['035']])
  })

  it('skips malformed rows instead of failing the run', () => {
    const rows = [
      { ...omonoia, StopCode: '1', StopLat: '0', StopLng: '0' },
      // latitude and longitude swapped
      { ...omonoia, StopCode: '2', StopLat: '23.72', StopLng: '37.98' },
      { ...omonoia, StopCode: '3', StopLat: 'x' },
      { ...omonoia, StopCode: null },
      { ...omonoia, StopCode: '4', StopDescr: null, StopID: null },
      null,
    ] as unknown as RawStop[]
    const { file, skipped } = toStopsFile([{ lineId: '040', stops: rows }])
    expect(file.stops).toEqual([['4', '', 'PL. OMONOIAS', 'PL. OMONOIAS', 37.983368, 23.727903, ['040']]])
    expect(skipped).toHaveLength(4)
  })

  it('gives the same output whatever order the routes finish in', () => {
    const renamed = { ...omonoia, StopDescr: 'ΟΜΟΝΟΙΑ' }
    const a = toStopsFile([
      { lineId: '040', stops: [omonoia] },
      { lineId: '400', stops: [renamed] },
    ])
    // Crawl order decides which name wins, not timing; the line lists match either way
    expect(a.file.stops[0][2]).toBe('ΠΛ. ΟΜΟΝΟΙΑΣ')
    expect(a.file.stops[0][6]).toEqual(['040', '400'])
  })
})

const row = (code: number, lines = ['040']): StopsFileRow => [String(code), '', 'X', null, 37.98, 23.72, lines]
const fileOf = (count: number, lines?: string[]): StopsFile => ({
  version: 1,
  stops: Array.from({ length: count }, (_, i) => row(i, lines)),
})

describe('shrinkError', () => {
  it('accepts a normal run', () => {
    expect(shrinkError(fileOf(8333), fileOf(8300))).toBeNull()
    expect(shrinkError(fileOf(8333), null)).toBeNull()
  })

  it('refuses an empty or tiny result even without a previous file', () => {
    expect(shrinkError(fileOf(0), null)).toMatch(/only 0 stops/)
    expect(shrinkError(fileOf(MIN_STOPS - 1), null, true)).toMatch(/expected at least/)
  })

  it('refuses a run that lost more than 10% of the stops', () => {
    expect(shrinkError(fileOf(7400), fileOf(8333))).toMatch(/down from 8333/)
    expect(shrinkError(fileOf(7500), fileOf(8333))).toBeNull()
  })

  it('refuses a run that lost whole lines even if their stops are still served by others', () => {
    expect(shrinkError(fileOf(8333, ['040']), fileOf(8333, ['040', '400']))).toMatch(/line-stop links/)
  })

  it('can be forced past the comparison with the previous file', () => {
    expect(shrinkError(fileOf(6000), fileOf(8333), true)).toBeNull()
  })
})
