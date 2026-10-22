import { describe, expect, it } from 'vitest'
import type { LngLat } from '../src/domain/polyline.ts'
import { parseGtfsTime, readCsv, stitchWays, toMetroFile, type GtfsFiles, type StationTable } from './metroData.ts'

describe('readCsv', () => {
  it('reads quoted fields, CRLF and a byte-order mark', () => {
    const rows: string[][] = []
    readCsv('﻿"a","b"\r\n"1","x, ""y"""\r\n2,\r\n', (fields) => rows.push(fields))
    expect(rows).toEqual([
      ['1', 'x, "y"'],
      ['2', ''],
    ])
  })

  it('looks columns up by name', () => {
    const values: string[] = []
    readCsv('id,name\n7,Omonia', (f, col) => values.push(f[col('name')]))
    expect(values).toEqual(['Omonia'])
    expect(() => readCsv('id\n7', (_, col) => col('name'))).toThrow('Missing column "name"')
  })
})

describe('parseGtfsTime', () => {
  it('counts past midnight', () => {
    expect(parseGtfsTime('05:30:15')).toBe(5 * 3600 + 30 * 60 + 15)
    expect(parseGtfsTime('25:04:00')).toBe(25 * 3600 + 4 * 60)
  })
})

describe('stitchWays', () => {
  it('joins ways drawn in either direction into one path', () => {
    const a: LngLat[] = [
      [23.7, 37.9],
      [23.71, 37.9],
    ]
    const b: LngLat[] = [
      [23.72, 37.9],
      [23.71, 37.9],
    ] // reversed
    const c: LngLat[] = [
      [23.72, 37.9],
      [23.73, 37.9],
    ]
    expect(stitchWays([a, b, c])).toEqual([
      [23.7, 37.9],
      [23.71, 37.9],
      [23.72, 37.9],
      [23.73, 37.9],
    ])
  })

  it('turns the first way round when the second joins its start', () => {
    const a: LngLat[] = [
      [23.71, 37.9],
      [23.7, 37.9],
    ]
    const b: LngLat[] = [
      [23.71, 37.9],
      [23.72, 37.9],
    ]
    expect(stitchWays([a, b])[0]).toEqual([23.7, 37.9])
  })

  it('refuses a large gap', () => {
    const a: LngLat[] = [
      [23.7, 37.9],
      [23.71, 37.9],
    ]
    const far: LngLat[] = [
      [23.75, 37.9],
      [23.76, 37.9],
    ]
    expect(() => stitchWays([a, far])).toThrow(/gap/)
  })
})

describe('toMetroFile', () => {
  // A straight 3-station M1 (~2.6 km), a track junction that isn't a station, and a tram trip to ignore
  const shapes: Record<string, LngLat[]> = {
    M1: [
      [23.7, 37.95],
      [23.73, 37.95],
    ],
    M2: [
      [23.7, 37.96],
      [23.71, 37.96],
    ],
    M3: [
      [23.7, 37.97],
      [23.71, 37.97],
    ],
  }
  const table: StationTable = {
    ΑΛΦΑ: ['alfa', 'Άλφα', 'Alfa'],
    ΒΗΤΑ: ['vita', 'Βήτα', 'Vita'],
    ΓΑΜΜΑ: ['gamma', 'Γάμμα', 'Gamma'],
    ΣΥΝΔΕΣΗ: null,
  }
  const gtfs: GtfsFiles = {
    'routes.txt': 'route_id,route_short_name\n4,M1\n1,T7\n',
    'stops.txt': [
      'stop_id,stop_name,stop_lat,stop_lon',
      '1,ΑΛΦΑ,37.95,23.70',
      '2,ΒΗΤΑ,37.95,23.71',
      '3,ΒΗΤΑ,37.9502,23.71', // the other platform
      '4,ΣΥΝΔΕΣΗ,37.95,23.715',
      '5,ΓΑΜΜΑ,37.95,23.73',
      '9,ΒΗΤΑ,38.10,23.90', // a tram stop with the same name, far away
    ].join('\n'),
    'trips.txt': 'route_id,service_id,trip_id\n4,A,t1\n4,A,t2\n4,B,t3\n1,A,tram\n',
    'stop_times.txt': [
      'trip_id,arrival_time,departure_time,stop_id,stop_sequence',
      // t1 and t2: same pattern, 10 minutes apart (listed out of order)
      't1,06:02:00,06:02:20,2,2',
      't1,06:00:00,06:00:00,1,1',
      't1,06:03:00,06:03:00,4,3',
      't1,06:05:00,06:05:00,5,4',
      't2,06:10:00,06:10:00,1,1',
      't2,06:12:00,06:12:20,2,2',
      't2,06:15:00,06:15:00,5,4',
      // t3: the other direction, after midnight
      't3,24:30:00,24:30:00,5,1',
      't3,24:33:00,24:33:30,3,2',
      't3,24:35:00,24:35:00,1,3',
      'tram,06:00:00,06:00:00,9,1',
    ].join('\n'),
    'calendar_dates.txt': '"service_id","date","exception_type"\n"A","20261021","1"\n"A","20261022","1"\n"B","20261022","1"\n"B","20261023","2"\n',
  }
  const file = toMetroFile(gtfs, shapes, table)

  it('groups platforms into stations, leaving out non-stations and other modes’ stops', () => {
    expect(file.stations.map((s) => s[0])).toEqual(['alfa', 'gamma', 'vita'])
    const vita = file.stations[2]
    expect(vita[3]).toBeCloseTo(37.9501, 6) // the two platforms' average, not the tram stop
  })

  it('places stations along the line in order', () => {
    const m1 = file.lines[0]
    expect(m1.id).toBe('M1')
    expect(m1.stops.map(([s]) => file.stations[s][0])).toEqual(['alfa', 'vita', 'gamma'])
    expect(m1.stops[0][1]).toBe(0)
    expect(m1.stops[2][1]).toBeGreaterThan(2500)
  })

  it('stores each distinct stop sequence and timing once', () => {
    expect(file.patterns).toEqual([
      { line: 0, stations: [0, 2, 1], times: [0, 0, 120, 140, 300, 300] },
      { line: 0, stations: [1, 2, 0], times: [0, 0, 180, 210, 300, 300] },
    ])
  })

  it('stores trips per day, sharing identical days', () => {
    expect(file.firstDate).toBe('2026-10-21')
    expect(file.lastDate).toBe('2026-10-22')
    const oct21 = file.plans[file.days['2026-10-21']]
    const oct22 = file.plans[file.days['2026-10-22']]
    expect(oct21).toEqual([0, 6 * 3600, 0, 6 * 3600 + 600])
    expect(oct22).toEqual([0, 6 * 3600, 0, 6 * 3600 + 600, 1, 24 * 3600 + 1800])
    // exception_type 2 (removed) dates don't count
    expect(file.days['2026-10-23']).toBeUndefined()
  })

  it('fails on a station missing from the table', () => {
    const withNew = { ...gtfs, 'stops.txt': gtfs['stops.txt'].replace('5,ΓΑΜΜΑ', '5,ΔΕΛΤΑ') }
    expect(() => toMetroFile(withNew, shapes, table)).toThrow('Stations missing from scripts/metro-stations.json: ΔΕΛΤΑ')
  })
})
