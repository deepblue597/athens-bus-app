import { describe, expect, it, vi } from 'vitest'
import { proxyOse } from './oseProxy.ts'

const request = (path: string, init?: RequestInit) => new Request(`https://bus.deepblue597.org${path}`, init)

describe('proxyOse', () => {
  it('fetches a station’s board and caches it for 30 seconds', async () => {
    const upstream = vi.fn(async () => new Response('{"routes":[]}', { status: 200, headers: { 'cache-control': 'no-store' } }))
    const res = await proxyOse(request('/ose/screens/18'), upstream)
    expect(upstream).toHaveBeenCalledWith(
      'https://ose.mpass.ltd/api/v1/screens/18/data/multilingual',
      expect.objectContaining({ cf: { cacheTtl: 30, cacheEverything: true } }),
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('public, max-age=30')
    expect(await res.text()).toBe('{"routes":[]}')
  })

  it('only fetches boards by number', async () => {
    const upstream = vi.fn()
    for (const path of ['/ose/screens/18/data', '/ose/screens/abc', '/ose/screens/12345', '/ose/screens/18%2F..%2Fareas', '/ose/other']) {
      expect((await proxyOse(request(path), upstream)).status).toBe(404)
    }
    expect((await proxyOse(request('/ose/screens/18', { method: 'POST' }), upstream)).status).toBe(405)
    expect(upstream).not.toHaveBeenCalled()
  })

  it('answers 502 when OSE cannot be reached or fails, and 404 for an unknown board', async () => {
    const unreachable = vi.fn(async () => {
      throw new TypeError('fetch failed')
    })
    expect((await proxyOse(request('/ose/screens/18'), unreachable)).status).toBe(502)
    const failing = vi.fn(async () => new Response('error', { status: 500 }))
    expect(await (await proxyOse(request('/ose/screens/18'), failing)).json()).toEqual({ error: 'OSE answered 500' })
    const missing = vi.fn(async () => new Response('', { status: 404 }))
    expect((await proxyOse(request('/ose/screens/9999'), missing)).status).toBe(404)
  })
})
