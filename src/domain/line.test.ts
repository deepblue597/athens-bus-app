import { describe, expect, it } from 'vitest'
import { timetableSides, type LineDirection, type Timetable } from './line'
import type { ScheduleTime } from './types'

const direction = (type: string, routeCode: string, from: string): LineDirection => ({
  type,
  routeCode,
  name: from,
  nameEn: null,
  from,
  variants: [],
})
const t = (label: string, minutesOfServiceDay: number): ScheduleTime => ({ label, minutesOfServiceDay })
const sides = (directions: LineDirection[], timetable: Timetable) =>
  timetableSides(directions, timetable).map((s) => [s.direction?.routeCode, s.times.map((x) => x.label)])

describe('timetableSides', () => {
  it('pairs outbound with RouteType 1 and inbound with RouteType 2', () => {
    // Line 040: routes 3922 (1) and 3923 (2)
    const directions = [direction('1', '3922', 'ΠΕΙΡΑΙΑΣ'), direction('2', '3923', 'ΣΥΝΤΑΓΜΑ')]
    expect(sides(directions, { outbound: [t('04:30', 270)], inbound: [t('04:40', 280)] })).toEqual([
      ['3922', ['04:30']],
      ['3923', ['04:40']],
    ])
  })

  it('keeps both sides of a two-way line even when one is empty', () => {
    const directions = [direction('1', '3922', 'ΠΕΙΡΑΙΑΣ'), direction('2', '3923', 'ΣΥΝΤΑΓΜΑ')]
    expect(sides(directions, { outbound: [t('04:30', 270)], inbound: [] })).toEqual([
      ['3922', ['04:30']],
      ['3923', []],
    ])
  })

  it('gives a circular line one side', () => {
    // Line 300 (885): one RouteType 1 route, trips only in `go`
    expect(sides([direction('1', '1898', 'ΠΛ. ΚΑΡΑΪΣΚΑΚΗ')], { outbound: [t('06:30', 390)], inbound: [] })).toEqual([
      ['1898', ['06:30']],
    ])
  })

  it('puts a variant’s inbound-only trips on its only route', () => {
    // Α7 variant 1663: its one route (4622) is RouteType 1, but its trip is listed in `come`
    expect(sides([direction('1', '4622', 'ΣΤΑΣΗ 1η ΚΡΥΟΝΕΡΙΟΥ')], { outbound: [], inbound: [t('05:05', 305)] })).toEqual([
      ['4622', ['05:05']],
    ])
  })

  it('handles a variant with only a RouteType 2 route', () => {
    // Α1 variant 1566: route 4451 is RouteType 2, trip in `come`
    expect(sides([direction('2', '4451', 'ΕΚΚΛΗΣΙΑ ΒΑΡΗΣ')], { outbound: [], inbound: [t('05:20', 320)] })).toEqual([
      ['4451', ['05:20']],
    ])
  })

  it('shows one empty side when there are no departures', () => {
    expect(sides([direction('1', '1898', 'ΠΛ. ΚΑΡΑΪΣΚΑΚΗ')], { outbound: [], inbound: [] })).toEqual([['1898', []]])
  })

  it('still splits the timetable while routes are loading', () => {
    expect(sides([], { outbound: [t('04:30', 270)], inbound: [t('04:40', 280)] })).toEqual([
      [undefined, ['04:30']],
      [undefined, ['04:40']],
    ])
  })
})
