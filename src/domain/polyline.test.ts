import { describe, expect, it } from 'vitest'
import { distanceInMeters } from './geo'
import { cumulativeLengths, pointAlong, projectOnto, segmentLength, simplify, type LngLat } from './polyline'

// An L-shaped path near Syntagma: ~880 m east, then ~1,110 m north
const path: LngLat[] = [
  [23.73, 37.975],
  [23.74, 37.975],
  [23.74, 37.985],
]
const cumulative = cumulativeLengths(path)

describe('cumulativeLengths', () => {
  it('adds up segment lengths', () => {
    expect(cumulative[0]).toBe(0)
    expect(cumulative[1]).toBeCloseTo(877, -1)
    expect(cumulative[2]).toBeCloseTo(877 + 1113, -1)
  })
})

describe('pointAlong', () => {
  it('interpolates within a segment', () => {
    const [lng, lat] = pointAlong(path, cumulative, cumulative[1] / 2)
    expect(lng).toBeCloseTo(23.735, 6)
    expect(lat).toBeCloseTo(37.975, 6)
  })

  it('continues round the corner', () => {
    const [lng, lat] = pointAlong(path, cumulative, cumulative[1] + (cumulative[2] - cumulative[1]) / 2)
    expect(lng).toBeCloseTo(23.74, 6)
    expect(lat).toBeCloseTo(37.98, 6)
  })

  it('clamps to the ends', () => {
    expect(pointAlong(path, cumulative, -50)).toEqual(path[0])
    expect(pointAlong(path, cumulative, 1e6)).toEqual(path[2])
  })
})

describe('projectOnto', () => {
  it('finds the distance along the path to a point beside it', () => {
    // 50 m south of the first segment's middle
    expect(projectOnto(path, cumulative, [23.735, 37.97455])).toBeCloseTo(cumulative[1] / 2, -1)
    // Beside the second segment
    expect(projectOnto(path, cumulative, [23.7405, 37.98])).toBeCloseTo((cumulative[1] + cumulative[2]) / 2, -1)
  })

  it('clamps points beyond the ends', () => {
    expect(projectOnto(path, cumulative, [23.72, 37.975])).toBe(0)
  })
})

describe('simplify', () => {
  it('drops points that barely bend the line and keeps corners', () => {
    const wobbly: LngLat[] = [
      [23.73, 37.975],
      [23.735, 37.97501], // ~1 m off the straight line
      [23.74, 37.975],
      [23.74, 37.985],
    ]
    expect(simplify(wobbly, 3)).toEqual([wobbly[0], wobbly[2], wobbly[3]])
  })

  it('keeps short paths as they are', () => {
    expect(simplify(path.slice(0, 2), 3)).toEqual(path.slice(0, 2))
  })
})

describe('segmentLength', () => {
  it('is close to the haversine distance at Athens’ latitude', () => {
    // Syntagma to Omonoia, ~1.1 km: within 1%
    const flat = segmentLength([23.7348, 37.9755], [23.7281, 37.9842])
    const haversine = distanceInMeters({ lat: 37.9755, lng: 23.7348 }, { lat: 37.9842, lng: 23.7281 })
    expect(Math.abs(flat - haversine) / haversine).toBeLessThan(0.01)
  })
})
