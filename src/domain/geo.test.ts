import { describe, expect, it } from 'vitest'
import { distanceInMeters, formatDistance } from './geo'

describe('distanceInMeters', () => {
  it('measures Syntagma to Omonoia as roughly 1.1 km', () => {
    const d = distanceInMeters({ lat: 37.9755, lng: 23.7348 }, { lat: 37.9842, lng: 23.7281 })
    expect(d).toBeGreaterThan(1000)
    expect(d).toBeLessThan(1200)
  })
})

describe('formatDistance', () => {
  it('rounds short distances to 10 m', () => {
    expect(formatDistance(64)).toBe('60 m')
  })

  it('shows longer distances in km', () => {
    expect(formatDistance(1260)).toBe('1.3 km')
  })
})
