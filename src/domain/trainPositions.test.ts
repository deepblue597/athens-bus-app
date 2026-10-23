import { describe, expect, it } from 'vitest'
import { fromMetroFile } from '../data/metroFile'
import type { MetroFile } from './metroFile'
import { addDays, estimateTrains, nextDepartures, oneWayTowards, planFor, serviceDayStart, timetableNotice } from './trainPositions'
import { athensTimeToEpoch } from './time'

// One straight line of three stations, A (0 m) – B (~877 m) – C (~1,754 m), and two days of trips:
//   pattern 0, A → C: leaves A at +0, B at 120–150 s, reaches C at 300 s
//   pattern 1, C → A: the same timings the other way
const file: MetroFile = {
  version: 2,
  firstDate: '2026-10-21',
  lastDate: '2026-10-22',
  lines: [
    {
      id: 'M1',
      mode: 'metro',
      color: '#007a33',
      stations: [0, 1, 2],
      tracks: [
        {
          path: [
            [23.73, 37.975],
            [23.75, 37.975],
          ],
          stops: [
            [0, 0],
            [1, 877],
            [2, 1754],
          ],
        },
      ],
    },
  ],
  stations: [
    ['a', 'Α', 'A', 37.975, 23.73],
    ['b', 'Β', 'B', 37.975, 23.74],
    ['c', 'Γ', 'C', 37.975, 23.75],
  ],
  patterns: [
    { line: 0, track: 0, stations: [0, 1, 2], times: [0, 0, 120, 150, 300, 300] },
    { line: 0, track: 0, stations: [2, 1, 0], times: [0, 0, 120, 150, 300, 300] },
  ],
  plans: [
    // Wednesday: 08:00 A→C, 08:10 C→A
    [0, 8 * 3600, 1, 8 * 3600 + 600],
    // Thursday: 08:00 A→C, and a late trip at 24:20 (00:20 on Friday) C→A
    [0, 8 * 3600, 1, 24 * 3600 + 1200],
  ],
  days: { '2026-10-21': 0, '2026-10-22': 1 },
}
const network = fromMetroFile(file)
const at = (date: string, h: number, m: number, s = 0) => {
  const [y, mo, d] = date.split('-').map(Number)
  return athensTimeToEpoch(y, mo, d, h, m, s)
}

describe('serviceDayStart', () => {
  it('is midnight on an ordinary day', () => {
    expect(serviceDayStart('2026-10-22')).toBe(at('2026-10-22', 0, 0))
  })

  it('is noon minus 12 hours on the night the clocks go back', () => {
    // 25 Oct 2026: noon is EET (UTC+2), so the service day starts at 22:00 UTC the evening before
    expect(serviceDayStart('2026-10-25')).toBe(Date.UTC(2026, 9, 24, 22, 0))
  })
})

describe('addDays', () => {
  it('crosses month ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31')
  })
})

describe('planFor', () => {
  it('uses the published day', () => {
    expect(planFor(network, '2026-10-22')).toEqual({ plan: 1, standIn: null })
  })

  it('stands in the latest published day of the same weekday after the timetable ends', () => {
    // Wednesday 28 Oct → Wednesday 21 Oct
    expect(planFor(network, '2026-10-28')).toEqual({ plan: 0, standIn: '2026-10-21' })
  })

  it('has nothing when no published day shares the weekday', () => {
    expect(planFor(network, '2026-10-24')).toBeNull()
  })
})

describe('estimateTrains', () => {
  it('shows nothing before the first train', () => {
    expect(estimateTrains(network, at('2026-10-21', 7, 59))).toEqual([])
  })

  it('puts a train waiting at a station on it', () => {
    const [train] = estimateTrains(network, at('2026-10-21', 8, 2, 10))
    expect(train).toMatchObject({ line: 0, from: 1, to: 2, atStation: true, destination: 2 })
    expect(train.lng).toBeCloseTo(23.74, 4)
  })

  it('puts a train halfway through its run halfway between the stations', () => {
    // A → B runs 0–120 s; at 60 s the eased progress is also 0.5
    const [train] = estimateTrains(network, at('2026-10-21', 8, 1, 0))
    expect(train).toMatchObject({ from: 0, to: 1, atStation: false })
    expect(train.lng).toBeCloseTo(23.735, 4)
  })

  it('eases out of the station: slower than linear at first', () => {
    // 30 s into a 120 s run: linear would be 25%, eased is ~16%
    const [train] = estimateTrains(network, at('2026-10-21', 8, 0, 30))
    expect(train.lng).toBeGreaterThan(23.73)
    expect(train.lng).toBeLessThan(23.73 + 0.01 * 0.25)
  })

  it('shows several trains at once, with stable keys', () => {
    const trains = estimateTrains(network, at('2026-10-21', 8, 10, 30))
    // 08:00 A→C has arrived (gone); 08:10 C→A is running
    expect(trains.map((t) => t.key)).toEqual(['2026-10-21:1'])
  })

  it('shows yesterday’s after-midnight trips', () => {
    // Thursday's 24:20 trip, at 00:21 on Friday 23 Oct (a date the timetable doesn't cover)
    const [train] = estimateTrains(network, at('2026-10-23', 0, 21))
    expect(train).toMatchObject({ key: '2026-10-22:1', from: 2, to: 1, destination: 0 })
  })

  it('removes a train once it reaches the end of its trip', () => {
    expect(estimateTrains(network, at('2026-10-21', 8, 5, 1))).toEqual([])
  })
})

describe('nextDepartures', () => {
  it('lists the next trains per direction, from the station’s departure time', () => {
    const groups = nextDepartures(network, 1, at('2026-10-21', 7, 0))
    expect(groups.map((g) => g.towards)).toEqual([0, 2])
    const towardsC = groups.find((g) => g.towards === 2)!
    // Leaves B at 08:02:30 (after waiting 30 s)
    expect(towardsC.departures[0].time).toBe(at('2026-10-21', 8, 2, 30))
    expect(towardsC.departures[0].destination).toBe(2)
    // Then Thursday's 08:00 trip, the next day
    expect(towardsC.departures[1].time).toBe(at('2026-10-22', 8, 2, 30))
  })

  it('has no departures from the end of a trip', () => {
    const groups = nextDepartures(network, 2, at('2026-10-21', 7, 0))
    expect(groups.map((g) => g.towards)).toEqual([0])
  })

  it('still shows a train that left seconds ago, and drops it after that', () => {
    const leaves = at('2026-10-21', 8, 2, 30)
    const first = (now: number) => nextDepartures(network, 1, now).find((g) => g.towards === 2)?.departures[0]?.time
    expect(first(leaves + 20_000)).toBe(leaves)
    expect(first(leaves + 40_000)).not.toBe(leaves)
  })
})

describe('timetableNotice', () => {
  it('is null within the published dates', () => {
    expect(timetableNotice(network, at('2026-10-22', 12, 0))).toBeNull()
  })

  it('names the stand-in day after the timetable ends', () => {
    expect(timetableNotice(network, at('2026-10-28', 12, 0))).toEqual({
      firstDate: '2026-10-21',
      lastDate: '2026-10-22',
      standIn: '2026-10-21',
    })
  })
})

describe('a tram line with a track per direction', () => {
  // A (0 m) → B → C along the south track; back C → D → A along the north one, D being a one-way stop
  const tram: MetroFile = {
    ...file,
    lines: [
      {
        id: 'T7',
        mode: 'tram',
        color: '#b05a00',
        stations: [0, 1, 3, 2],
        tracks: [
          {
            path: [
              [23.73, 37.975],
              [23.75, 37.975],
            ],
            stops: [
              [0, 0],
              [1, 877],
              [2, 1754],
            ],
          },
          {
            path: [
              [23.75, 37.976],
              [23.73, 37.976],
            ],
            stops: [
              [2, 0],
              [3, 877],
              [0, 1754],
            ],
          },
        ],
      },
    ],
    stations: [...file.stations, ['d', 'Δ', 'D', 37.976, 23.74]],
    patterns: [
      { line: 0, track: 0, stations: [0, 1, 2], times: [0, 0, 120, 150, 300, 300] },
      { line: 0, track: 1, stations: [2, 3, 0], times: [0, 0, 120, 150, 300, 300] },
    ],
  }
  const net = fromMetroFile(tram)

  it('runs each direction along its own track', () => {
    // Wednesday 08:10 C → A: at D, on the north track, at 08:12:10
    const [train] = estimateTrains(net, at('2026-10-21', 8, 12, 10))
    expect(train).toMatchObject({ from: 3, atStation: true, destination: 0 })
    expect(train.lat).toBeCloseTo(37.976, 5)
    expect(train.lng).toBeCloseTo(23.74, 3)
  })

  it('groups departures by the end trains head for', () => {
    const groups = nextDepartures(net, 0, at('2026-10-21', 7, 0))
    expect(groups.map((g) => g.towards)).toEqual([2])
    expect(nextDepartures(net, 2, at('2026-10-21', 7, 0)).map((g) => g.towards)).toEqual([0])
  })

  it('knows a one-way stop', () => {
    const line = net.lines[0]
    expect(line.departsTowards.get(3)).toEqual([0])
    expect(oneWayTowards(line, 3)).toBe(0)
    expect(oneWayTowards(line, 1)).toBe(2)
    // Termini aren't one-way stops, though trains leave them one way
    expect(oneWayTowards(line, 0)).toBeNull()
    expect(net.stations[3].mode).toBe('tram')
  })
})

describe('fromMetroFile', () => {
  it('refuses a file in another format', () => {
    expect(() => fromMetroFile({ ...file, version: 1 })).toThrow('Unsupported timetable format (1)')
  })
})
