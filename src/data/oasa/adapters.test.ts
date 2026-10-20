import { describe, expect, it } from 'vitest'
import type { IArrival, IBusLocation, IClosestStop, IRouteOfStop } from 'oasa-telematics-api'
import {
  asList,
  OasaApiError,
  parseScheduleTime,
  toArrivals,
  toNearbyStop,
  toNearbyStops,
  toStopRoutes,
  withRoutes,
} from './adapters'
// Real responses captured on 2026-10-20
import arrivalsListedTwice from './__fixtures__/getStopArrivals-10272.json'
import routesWithHidden from './__fixtures__/webRoutesForStop-10549.json'
import closestToSyntagma from './__fixtures__/getClosestStops-syntagma.json'

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

function routeOfStop(RouteCode: string, LineID: string): IRouteOfStop {
  return {
    RouteCode,
    LineCode: '962',
    hidden: '0',
    RouteDescr: 'ΠΕΙΡΑΙΑΣ - ΑΝΩ ΓΛΥΦΑΔΑ',
    RouteDescrEng: 'PEIRAIAS - ANO GLYFADA',
    RouteType: '1',
    RouteDistance: '18000',
    LineID,
    LineDescr: 'ΠΕΙΡΑΙΑΣ - ΑΝΩ ΓΛΥΦΑΔΑ',
    LineDescrEng: 'PEIRAIAS - ANO GLYFADA',
    MasterLineCode: '100',
  }
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

  it('turns missing English names into null', () => {
    // The API returns null here even though the library types say string
    const stop = toNearbyStop({ ...omonoia, StopDescrEng: null as unknown as string }, { lat: 37.98, lng: 23.72 })
    expect(stop.nameEn).toBeNull()
  })
})

describe('toStopRoutes', () => {
  it('keeps one entry per route code', () => {
    const routes = toStopRoutes([routeOfStop('1881', 'Β1'), routeOfStop('1881', 'Β1'), routeOfStop('4051', 'Β1')])
    expect(routes.map((r) => r.routeCode)).toEqual(['1881', '4051'])
  })

  it('returns an empty list for null', () => {
    expect(toStopRoutes(null)).toEqual([])
  })
})

describe('toArrivals', () => {
  it('parses the minutes as a number', () => {
    expect(toArrivals([{ route_code: '2810', veh_code: '52320', btime2: '8' }])).toEqual([
      { routeCode: '2810', vehicleCode: '52320', minutes: 8 },
    ])
  })

  it('returns an empty list when no bus is due (API returns null)', () => {
    expect(toArrivals(null)).toEqual([])
  })
})

describe('withRoutes', () => {
  it('attaches the route and sorts soonest first', () => {
    const result = withRoutes(
      [
        { routeCode: '1881', vehicleCode: 'a', minutes: 12 },
        { routeCode: '9999', vehicleCode: 'b', minutes: 3 },
      ],
      toStopRoutes([routeOfStop('1881', 'Β1')]),
    )
    expect(result.map((a) => [a.minutes, a.route?.lineId ?? null])).toEqual([
      [3, null],
      [12, 'Β1'],
    ])
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

describe('asList', () => {
  it('passes lists through', () => {
    expect(asList([1, 2])).toEqual([1, 2])
  })

  it('treats null (most endpoints) and "" (getBusLocation) as an empty list', () => {
    expect(asList(null)).toEqual([])
    expect(asList('' as unknown as IBusLocation[])).toEqual([])
  })

  it('throws on the {"error": ...} body OASA sends with status 200', () => {
    const raw = { error: 'invalid parameters' } as unknown as IArrival[]
    expect(() => asList(raw)).toThrow(OasaApiError)
    expect(() => asList(raw)).toThrow('invalid parameters')
  })
})

describe('toArrivals with real responses', () => {
  it('lists each bus once when the API repeats every row (stop 10272)', () => {
    expect(arrivalsListedTwice).toHaveLength(28)
    const arrivals = toArrivals(arrivalsListedTwice)
    expect(arrivals).toHaveLength(14)
    expect(new Set(arrivals.map((a) => `${a.routeCode}-${a.vehicleCode}`)).size).toBe(14)
    expect(arrivals[0]).toEqual({ routeCode: '4373', vehicleCode: '44583', minutes: 4 })
  })

  it('keeps the soonest estimate when a vehicle is listed with different times', () => {
    const arrivals = toArrivals([
      { route_code: '2085', veh_code: '61255', btime2: '40' },
      { route_code: '2085', veh_code: '61255', btime2: '12' },
    ])
    expect(arrivals).toEqual([{ routeCode: '2085', vehicleCode: '61255', minutes: 12 }])
  })

  it('skips estimates that are not a number instead of showing them as "Now"', () => {
    const raw = [{ route_code: '2085', veh_code: '61255', btime2: null }] as unknown as IArrival[]
    expect(toArrivals(raw)).toEqual([])
  })
})

describe('toStopRoutes with real responses', () => {
  it('leaves out hidden detour and seasonal routes (stop 10549)', () => {
    const routes = toStopRoutes(routesWithHidden as IRouteOfStop[])
    expect(routesWithHidden).toHaveLength(6)
    expect(routes.map((r) => [r.routeCode, r.lineId])).toEqual([['3766', '20']])
  })
})

describe('toNearbyStops', () => {
  const syntagma = { lat: 37.9755, lng: 23.7348 }
  const raw = closestToSyntagma as IClosestStop[]

  it('only keeps the radius the API is guaranteed to have covered', () => {
    // The API returned stops up to 333 m away but left out 61263 (301 m) and 61020 (317 m),
    // found by querying points around Syntagma. Its 20th stop is 0.0035° away, i.e. 262 m east-west.
    expect(raw).toHaveLength(20)
    const stops = toNearbyStops(raw, syntagma, 1500)
    expect(stops).toHaveLength(17)
    expect(Math.max(...stops.map((s) => s.distanceMeters))).toBeLessThan(301)
    expect(stops.map((s) => s.code)).not.toContain('60048')
  })

  it('sorts by distance in metres, which can differ from the API order', () => {
    const distances = toNearbyStops(raw, syntagma, 1500).map((s) => s.distanceMeters)
    expect(distances).toEqual([...distances].sort((a, b) => a - b))
    expect(distances[0]).toBe(66)
  })

  it('keeps everything within maxMeters when the API returned fewer than 20 stops', () => {
    const stops = toNearbyStops(raw.slice(0, 19), syntagma, 1500)
    expect(stops).toHaveLength(19)
  })

  it('applies maxMeters', () => {
    expect(toNearbyStops(raw, syntagma, 100).map((s) => s.code)).toEqual(['10361', '60003', '60025', '60718', '60774', '60991'])
  })

  it('returns an empty list for null (unparseable coordinates)', () => {
    expect(toNearbyStops(null, syntagma, 1500)).toEqual([])
  })
})
