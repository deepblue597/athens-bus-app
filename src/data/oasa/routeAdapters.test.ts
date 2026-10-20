import { describe, expect, it } from 'vitest'
import type { IStop } from 'oasa-telematics-api'
import { toRouteDetails } from './routeAdapters'

function stop(StopCode: string, RouteStopOrder: string): IStop {
  return {
    StopCode,
    StopID: StopCode,
    StopDescr: `ΣΤΑΣΗ ${StopCode}`,
    StopDescrEng: `STOP ${StopCode}`,
    StopStreet: null,
    StopStreetEng: null,
    StopHeading: '140',
    StopLat: '37.98566',
    StopLng: '23.73113',
    RouteStopOrder,
    StopType: '0',
    StopAmea: '0',
  }
}

describe('toRouteDetails', () => {
  // Shape from webGetRoutesDetailsAndStops&p1=2484 (2026-10-20)
  it('reads routed_x as longitude and routed_y as latitude, in route order', () => {
    const route = toRouteDetails('2484', {
      details: [
        { routed_x: '23.73147', routed_y: '37.98522', routed_order: '2' },
        { routed_x: '23.73153', routed_y: '37.98545', routed_order: '1' },
      ],
      stops: [],
    })
    expect(route.path).toEqual([
      { lat: 37.98545, lng: 23.73153 },
      { lat: 37.98522, lng: 23.73147 },
    ])
  })

  it('orders stops by their position on the route', () => {
    const route = toRouteDetails('2484', { details: [], stops: [stop('b', '10'), stop('a', '2')] })
    expect(route.stops.map((s) => [s.code, s.order])).toEqual([
      ['a', 2],
      ['b', 10],
    ])
  })

  it('returns an empty route for unknown codes', () => {
    expect(toRouteDetails('999999', { details: [], stops: [] })).toEqual({ routeCode: '999999', path: [], stops: [] })
    expect(toRouteDetails('999999', null)).toEqual({ routeCode: '999999', path: [], stops: [] })
  })
})
