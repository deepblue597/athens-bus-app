import { describe, expect, it, vi } from 'vitest'
import { proxyOasa } from './oasaProxy.ts'

const ok = (body: string) => new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=UTF-8' } })
const request = (path: string) => new Request(`https://bus.deepblue597.org${path}`)

describe('proxyOasa', () => {
  it('forwards an allowed call with its query and labels the answer as JSON', async () => {
    const upstream = vi.fn(async () => ok('[{"route_code":"2810"}]'))
    const res = await proxyOasa(request('/oasa/api/?act=getStopArrivals&p1=400075'), upstream)
    expect(upstream).toHaveBeenCalledWith(
      'https://telematics.oasa.gr/api/?act=getStopArrivals&p1=400075',
      expect.objectContaining({ cf: { cacheTtl: 5, cacheEverything: true } }),
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8')
    expect(res.headers.get('cache-control')).toBe('public, max-age=5')
    expect(await res.text()).toBe('[{"route_code":"2810"}]')
  })

  it('caches route data longer than live data', async () => {
    const upstream = vi.fn(async () => ok('[]'))
    const res = await proxyOasa(request('/oasa/api/?act=webGetRoutes&p1=938'), upstream)
    expect(res.headers.get('cache-control')).toBe('public, max-age=3600')
  })

  it('refuses calls the app does not make', async () => {
    const upstream = vi.fn()
    expect((await proxyOasa(request('/oasa/api/?act=somethingElse'), upstream)).status).toBe(400)
    expect((await proxyOasa(request('/oasa/api/'), upstream)).status).toBe(400)
    expect(upstream).not.toHaveBeenCalled()
  })

  it('only proxies GET requests', async () => {
    const upstream = vi.fn()
    const post = new Request('https://bus.deepblue597.org/oasa/api/?act=getStopArrivals&p1=1', { method: 'POST' })
    expect((await proxyOasa(post, upstream)).status).toBe(405)
    expect(upstream).not.toHaveBeenCalled()
  })

  it('only serves /oasa/api/', async () => {
    const upstream = vi.fn()
    expect((await proxyOasa(request('/oasa/other?act=getStopArrivals'), upstream)).status).toBe(404)
    expect(upstream).not.toHaveBeenCalled()
  })

  it('answers 502 when OASA cannot be reached or fails', async () => {
    const unreachable = vi.fn(async () => {
      throw new TypeError('fetch failed')
    })
    expect((await proxyOasa(request('/oasa/api/?act=getStopArrivals&p1=1'), unreachable)).status).toBe(502)
    const forbidden = vi.fn(async () => new Response('<html>403</html>', { status: 403 }))
    const res = await proxyOasa(request('/oasa/api/?act=getStopArrivals&p1=1'), forbidden)
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: 'OASA answered 403' })
  })
})
