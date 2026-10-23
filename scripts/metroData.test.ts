import { describe, expect, it } from 'vitest'
import type { LngLat } from '../src/domain/polyline.ts'
import { mergeStationOrders, parseGtfsTime, readCsv, stitchWays, toMetroFile, type GtfsFiles, type StationTables } from './metroData.ts'

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
  // A straight 3-station M1 (~2.6 km) with a track junction that isn't a station, and a T7 whose return
  // trip loops north through a one-way stop, ΖΗΤΑ. The tram has its own ΒΗΤΑ, far from the metro's.
  const shapes: Record<string, LngLat[][]> = {
    M1: [
      [
        [23.7, 37.95],
        [23.73, 37.95],
      ],
    ],
    M2: [
      [
        [23.7, 37.96],
        [23.71, 37.96],
      ],
    ],
    M3: [
      [
        [23.7, 37.97],
        [23.71, 37.97],
      ],
    ],
    T6: [
      [
        [23.7, 37.98],
        [23.71, 37.98],
      ],
    ],
    T7: [
      [
        [23.9, 38.1],
        [23.92, 38.1],
      ],
      [
        [23.92, 38.1],
        [23.92, 38.103],
        [23.9, 38.103],
        [23.9, 38.1],
      ],
    ],
  }
  const tables: StationTables = {
    metro: {
      ΑΛΦΑ: ['alfa', 'Άλφα', 'Alfa'],
      ΒΗΤΑ: ['vita', 'Βήτα', 'Vita'],
      ΓΑΜΜΑ: ['gamma', 'Γάμμα', 'Gamma'],
      ΣΥΝΔΕΣΗ: null,
    },
    tram: {
      ΒΗΤΑ: ['tram-vita', 'Βήτα', 'Vita'],
      ΕΨΙΛΟΝ: ['tram-epsilon', 'Έψιλον', 'Epsilon'],
      // The feed has it in the wrong place
      ΖΗΤΑ: ['tram-zita', 'Ζήτα', 'Zita', [38.103, 23.91]],
    },
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
      '9,ΒΗΤΑ,38.10,23.90', // the tram's
      '10,ΕΨΙΛΟΝ,38.10,23.92',
      '11,ΖΗΤΑ,38.11,23.91',
      '12,ΒΗΤΑ,38.10,23.90',
    ].join('\n'),
    'trips.txt': 'route_id,service_id,trip_id\n4,A,t1\n4,A,t2\n4,B,t3\n1,A,tram1\n1,A,tram2\n',
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
      'tram1,06:00:00,06:00:00,9,1',
      'tram1,06:04:00,06:04:00,10,2',
      'tram2,06:30:00,06:30:00,10,1',
      'tram2,06:32:00,06:32:00,11,2',
      'tram2,06:34:00,06:34:00,12,3',
    ].join('\n'),
    'calendar_dates.txt': '"service_id","date","exception_type"\n"A","20261021","1"\n"A","20261022","1"\n"B","20261022","1"\n"B","20261023","2"\n',
  }
  const file = toMetroFile(gtfs, shapes, tables)
  const ids = (stations: number[]) => stations.map((s) => file.stations[s][0])

  it('groups platforms into stations, each mode with its own table', () => {
    expect(file.stations.map((s) => s[0])).toEqual(['alfa', 'gamma', 'tram-epsilon', 'tram-vita', 'tram-zita', 'vita'])
    const vita = file.stations[5]
    expect(vita[3]).toBeCloseTo(37.9501, 6) // the two platforms' average, not the tram stop
  })

  it('uses a corrected position over the feed’s', () => {
    expect(file.stations[4].slice(3)).toEqual([38.103, 23.91])
  })

  it('places stations along the line in order', () => {
    const m1 = file.lines[0]
    expect(m1).toMatchObject({ id: 'M1', mode: 'metro' })
    expect(ids(m1.stations)).toEqual(['alfa', 'vita', 'gamma'])
    const [track] = m1.tracks
    expect(ids(track.stops.map(([s]) => s))).toEqual(['alfa', 'vita', 'gamma'])
    expect(track.stops[0][1]).toBe(0)
    expect(track.stops[2][1]).toBeGreaterThan(2500)
  })

  it('stores each distinct stop sequence and timing once, with the track it runs along', () => {
    expect(file.patterns).toEqual([
      { line: 0, track: 0, stations: [0, 5, 1], times: [0, 0, 120, 140, 300, 300] },
      { line: 0, track: 0, stations: [1, 5, 0], times: [0, 0, 180, 210, 300, 300] },
      { line: 4, track: 0, stations: [3, 2], times: [0, 0, 240, 240] },
      { line: 4, track: 1, stations: [2, 4, 3], times: [0, 0, 120, 120, 240, 240] },
    ])
  })

  it('lists a tram line’s one-way stops among the others', () => {
    const t7 = file.lines[4]
    expect(t7).toMatchObject({ id: 'T7', mode: 'tram' })
    expect(ids(t7.stations)).toEqual(['tram-vita', 'tram-zita', 'tram-epsilon'])
    expect(ids(t7.tracks[1].stops.map(([s]) => s))).toEqual(['tram-epsilon', 'tram-zita', 'tram-vita'])
  })

  it('stores trips per day, sharing identical days', () => {
    expect(file.firstDate).toBe('2026-10-21')
    expect(file.lastDate).toBe('2026-10-22')
    const oct21 = file.plans[file.days['2026-10-21']]
    const oct22 = file.plans[file.days['2026-10-22']]
    expect(oct21).toEqual([0, 6 * 3600, 2, 6 * 3600, 0, 6 * 3600 + 600, 3, 6 * 3600 + 1800])
    expect(oct22).toEqual([...oct21, 1, 24 * 3600 + 1800])
    // exception_type 2 (removed) dates don't count
    expect(file.days['2026-10-23']).toBeUndefined()
  })

  it('fails on a station missing from the table', () => {
    const withNew = { ...gtfs, 'stops.txt': gtfs['stops.txt'].replace('5,ΓΑΜΜΑ', '5,ΔΕΛΤΑ') }
    expect(() => toMetroFile(withNew, shapes, tables)).toThrow('Stops missing from scripts/metro-stations.json or tram-stops.json: ΔΕΛΤΑ (metro)')
  })

  it('fails on a trip that follows none of its line’s tracks', () => {
    const far = { ...tables, tram: { ...tables.tram, ΖΗΤΑ: ['tram-zita', 'Ζήτα', 'Zita', [38.2, 23.91]] as [string, string, string, [number, number]] } }
    expect(() => toMetroFile(gtfs, shapes, far)).toThrow('A T7 trip Έψιλον → Βήτα follows none of its tracks')
  })
})

describe('mergeStationOrders', () => {
  it('puts stops only in later orders before the next shared stop, reading reversed orders backwards', () => {
    expect(mergeStationOrders([[1, 2, 3, 4], [4, 9, 3, 8, 1]])).toEqual([1, 2, 8, 3, 9, 4])
    expect(mergeStationOrders([[1, 2], [2, 5]])).toEqual([1, 2, 5])
    expect(mergeStationOrders([[], [7, 8]])).toEqual([7, 8])
  })
})
