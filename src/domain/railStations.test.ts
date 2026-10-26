import { describe, expect, it } from 'vitest'
import { fromMetroFile } from '../data/metroFile'
import type { MetroFile } from './metroFile'
import { stationsNear } from './railStations'

const file: MetroFile = {
  version: 3,
  firstDate: '2026-10-21',
  lastDate: '2026-10-21',
  lines: [{ id: 'M2', mode: 'metro', color: '#da291c', textColor: '#ffffff', stations: [0, 1, 2], tracks: [{ path: [[23.7, 37.97], [23.8, 37.97]], stops: [] }] }],
  stations: [
    ['syntagma', 'Σύνταγμα', 'Syntagma', 37.9755, 23.7348],
    ['akropoli', 'Ακρόπολη', 'Akropoli', 37.9688, 23.7296],
    ['omonia', 'Ομόνοια', 'Omonia', 37.9842, 23.7281],
  ],
  patterns: [],
  plans: [[]],
  days: { '2026-10-21': 0 },
}
const network = fromMetroFile(file)

describe('stationsNear', () => {
  it('lists stations within the distance, closest first', () => {
    const near = stationsNear(network, { lat: 37.9755, lng: 23.7348 }, 1000, 5)
    expect(near.map((n) => n.station.id)).toEqual(['syntagma', 'akropoli'])
    expect(near[0].metres).toBe(0)
    expect(near[1].metres).toBeGreaterThan(800)
  })

  it('keeps at most `limit`', () => {
    expect(stationsNear(network, { lat: 37.9755, lng: 23.7348 }, 2000, 2)).toHaveLength(2)
  })
})
