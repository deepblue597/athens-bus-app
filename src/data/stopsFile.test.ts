import { describe, expect, it } from 'vitest'
import type { StopsFile } from '../domain/stopsFile'
import { fromStopsFile, nearestStops } from './stopsFile'

// Rows from public/data/stops.json (2026-10-20)
const file: StopsFile = {
  version: 1,
  stops: [
    ['10361', '000156', 'ΣΥΝΤΑΓΜΑ', 'SYNTAGMA', 37.975, 23.7349, ['040', '550']],
    ['60134', '060134', 'ΠΛ. ΟΜΟΝΟΙΑΣ', 'PL. OMONOIAS', 37.983368, 23.727903, ['026', '035']],
    ['10175', '18', 'ΠΛ. ΚΑΝΙΓΓΟΣ', null, 37.98566, 23.73113, ['021']],
  ],
}

describe('fromStopsFile', () => {
  it('turns rows into stops', () => {
    expect(fromStopsFile(file)[0]).toEqual({
      code: '10361',
      displayId: '000156',
      name: 'ΣΥΝΤΑΓΜΑ',
      nameEn: 'SYNTAGMA',
      street: null,
      lat: 37.975,
      lng: 23.7349,
      lines: ['040', '550'],
    })
  })
})

describe('nearestStops', () => {
  it('returns stops within the radius, closest first', () => {
    const stops = nearestStops(fromStopsFile(file), { lat: 37.9838, lng: 23.7275 }, 600)
    expect(stops.map((s) => [s.code, s.distanceMeters])).toEqual([
      ['60134', 60],
      ['10175', 379],
    ])
  })

  it('returns at most `limit` stops, like getClosestStops', () => {
    const stops = nearestStops(fromStopsFile(file), { lat: 37.9838, lng: 23.7275 }, 2000, 2)
    expect(stops.map((s) => s.code)).toEqual(['60134', '10175'])
  })
})
