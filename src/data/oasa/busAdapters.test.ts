import { describe, expect, it } from 'vitest'
import type { IBusLocation } from 'oasa-telematics-api'
import { parseOasaDate, toBusLocations } from './adapters'

// Real row from getBusLocation&p1=2484 (2026-10-20)
const bus: IBusLocation = {
  VEH_NO: '12231',
  CS_DATE: 'Oct 20 2026 08:56:56:000PM',
  CS_LAT: '37.988435',
  CS_LNG: '23.74705',
  ROUTE_CODE: '2484',
  VEH_HEADING: '257',
}

describe('parseOasaDate', () => {
  it('reads Athens summer time (UTC+3)', () => {
    expect(new Date(parseOasaDate('Oct 20 2026 08:56:56:000PM')!).toISOString()).toBe('2026-10-20T17:56:56.000Z')
  })

  it('reads Athens winter time (UTC+2)', () => {
    expect(new Date(parseOasaDate('Dec  1 2026 12:05:00:000AM')!).toISOString()).toBe('2026-11-30T22:05:00.000Z')
  })

  it('handles noon and midnight in 12-hour format', () => {
    expect(new Date(parseOasaDate('Jul 1 2026 12:00:00:000PM')!).toISOString()).toBe('2026-07-01T09:00:00.000Z')
  })

  it('returns null for an unexpected format', () => {
    expect(parseOasaDate('2026-10-20 20:56')).toBeNull()
    expect(parseOasaDate(null)).toBeNull()
  })
})

describe('toBusLocations', () => {
  it('maps a bus', () => {
    expect(toBusLocations([bus])).toEqual([
      { vehicleCode: '12231', lat: 37.988435, lng: 23.74705, heading: 257, reportedAt: Date.parse('2026-10-20T17:56:56Z') },
    ])
  })

  it('keeps a bus without a heading', () => {
    expect(toBusLocations([{ ...bus, VEH_HEADING: null as unknown as string }])[0].heading).toBeNull()
  })

  it('returns no buses for "" and null', () => {
    expect(toBusLocations('')).toEqual([])
    expect(toBusLocations(null)).toEqual([])
  })

  it('drops rows without a usable position', () => {
    expect(toBusLocations([{ ...bus, CS_LAT: '0', CS_LNG: '0' }, { ...bus, CS_LAT: 'x' }])).toEqual([])
  })
})
