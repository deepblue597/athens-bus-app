import { describe, expect, it } from 'vitest'
import type { IClosestStop } from 'oasa-telematics-api'
import { distanceInMeters, parseScheduleTime, toArrival, toNearbyStop } from './adapters'

// Real response from getClosestStops&p1=37.9838&p2=23.7275 (2026-10-20)
const omonoia: IClosestStop = {
  StopCode: '60134',
  StopID: '060134',
  StopDescr: 'ΠΛ. ΟΜΟΝΟΙΑΣ',
  StopDescrEng: 'PL. OMONOIAS',
  StopStreet: 'ΑΘΗΝΑΣ',
  StopStreetEng: null,
  StopHeading: '14',
  StopLat: '37.9833682',
  StopLng: '23.7279031',
  distance: '0.0005907121549459193',
}

describe('toNearbyStop', () => {
  it('maps fields and parses coordinates as numbers', () => {
    const stop = toNearbyStop(omonoia, { lat: 37.9838, lng: 23.7275 })
    expect(stop).toMatchObject({ code: '60134', displayId: '060134', name: 'ΠΛ. ΟΜΟΝΟΙΑΣ', lat: 37.9833682, lng: 23.7279031 })
  })

  it('computes the distance in metres from the origin', () => {
    const stop = toNearbyStop(omonoia, { lat: 37.9838, lng: 23.7275 })
    expect(stop.distanceMeters).toBeGreaterThan(55)
    expect(stop.distanceMeters).toBeLessThan(70)
  })
})

describe('distanceInMeters', () => {
  it('measures Syntagma to Omonoia as roughly 1.1 km', () => {
    const d = distanceInMeters({ lat: 37.9755, lng: 23.7348 }, { lat: 37.9842, lng: 23.7281 })
    expect(d).toBeGreaterThan(1000)
    expect(d).toBeLessThan(1200)
  })
})

describe('toArrival', () => {
  it('parses the minutes as a number', () => {
    expect(toArrival({ route_code: '2810', veh_code: '52320', btime2: '8' })).toEqual({
      routeCode: '2810',
      vehicleCode: '52320',
      minutes: 8,
    })
  })
})

describe('parseScheduleTime', () => {
  it('reads the time of day', () => {
    expect(parseScheduleTime('1900-01-01 05:10:00')).toEqual({ label: '05:10', minutesOfServiceDay: 310 })
  })

  it('places after-midnight trips after the rest of the day', () => {
    expect(parseScheduleTime('1900-01-02 00:30:00')).toEqual({ label: '00:30', minutesOfServiceDay: 1470 })
  })

  it('returns null for the empty direction of a trip', () => {
    expect(parseScheduleTime(null)).toBeNull()
  })
})
