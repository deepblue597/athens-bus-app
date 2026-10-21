import { describe, expect, it, vi } from 'vitest'
import { proxyOasaWeb, type EdgeCache } from './oasaWebProxy.ts'

const LIST_UPSTREAM =
  'https://www.oasa.gr/wp-json/wp/v2/posts?categories=82&per_page=20&_fields=id%2Cdate_gmt%2Cmodified_gmt%2Clink%2Ctitle%2Ccontent'
const POSTS = '[{"id":1,"date_gmt":"2026-10-21T09:01:22"}]'

const request = (path: string, init?: RequestInit) => new Request(`https://bus.deepblue597.org${path}`, init)
const ok = (body: string) => new Response(body, { status: 200, headers: { 'set-cookie': 'shop_per_page=12', 'cache-control': 'max-age=0' } })

/** An in-memory stand-in for Cloudflare's caches.default */
function fakeCache(): EdgeCache & { store: Map<string, Response> } {
  const store = new Map<string, Response>()
  return {
    store,
    async match(key) {
      return store.get(key.url)?.clone()
    },
    async put(key, response) {
      store.set(key.url, response.clone())
    },
  }
}

describe('proxyOasaWeb', () => {
  it('asks oasa.gr for the announcements category with fixed parameters, ignoring any it was sent', async () => {
    const upstream = vi.fn(async () => ok(POSTS))
    const res = await proxyOasaWeb(request('/oasa-web/wp-json/wp/v2/posts?per_page=100&categories=1&_fields=password'), undefined, {
      fetchUpstream: upstream,
      cache: null,
    })
    expect(upstream).toHaveBeenCalledWith(LIST_UPSTREAM, expect.anything())
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8')
    expect(res.headers.get('set-cookie')).toBeNull()
    expect(await res.text()).toBe(POSTS)
  })

  it('passes on a valid `before` cursor', async () => {
    const upstream = vi.fn(async () => ok('[]'))
    await proxyOasaWeb(request('/oasa-web/wp-json/wp/v2/posts?before=2026-10-14T04:00:01Z'), undefined, { fetchUpstream: upstream, cache: null })
    expect(upstream).toHaveBeenCalledWith(`${LIST_UPSTREAM}&before=2026-10-14T04%3A00%3A01Z`, expect.anything())
  })

  it('fetches a single post by id', async () => {
    const upstream = vi.fn(async () => ok('{"id":14870}'))
    const res = await proxyOasaWeb(request('/oasa-web/wp-json/wp/v2/posts/14870'), undefined, { fetchUpstream: upstream, cache: null })
    expect(upstream).toHaveBeenCalledWith(
      'https://www.oasa.gr/wp-json/wp/v2/posts/14870?_fields=id%2Cdate_gmt%2Cmodified_gmt%2Clink%2Ctitle%2Ccontent',
      expect.anything(),
    )
    expect(res.status).toBe(200)
  })

  it('refuses anything else', async () => {
    const upstream = vi.fn()
    const options = { fetchUpstream: upstream, cache: null }
    expect((await proxyOasaWeb(request('/oasa-web/wp-json/wp/v2/posts?before=2026-10-14T04:00:01'), undefined, options)).status).toBe(400)
    expect((await proxyOasaWeb(request('/oasa-web/wp-json/wp/v2/posts?before=x%26author=1'), undefined, options)).status).toBe(400)
    expect((await proxyOasaWeb(request('/oasa-web/wp-json/wp/v2/users'), undefined, options)).status).toBe(404)
    expect((await proxyOasaWeb(request('/oasa-web/wp-json/wp/v2/posts/1/revisions'), undefined, options)).status).toBe(404)
    expect((await proxyOasaWeb(request('/oasa-web/wp-json/wp/v2/posts/abc'), undefined, options)).status).toBe(404)
    expect((await proxyOasaWeb(request('/oasa-web/wp-json/wp/v2/posts', { method: 'POST' }), undefined, options)).status).toBe(405)
    expect(upstream).not.toHaveBeenCalled()
  })

  it('answers 404 for a post oasa.gr doesn’t have', async () => {
    const upstream = vi.fn(async () => new Response('{"code":"rest_post_invalid_id"}', { status: 404 }))
    const res = await proxyOasaWeb(request('/oasa-web/wp-json/wp/v2/posts/999'), undefined, { fetchUpstream: upstream, cache: null })
    expect(res.status).toBe(404)
  })

  it('serves a fresh saved copy without asking oasa.gr, and asks again once it is old', async () => {
    const cache = fakeCache()
    let now = 1_000_000
    const upstream = vi.fn(async () => ok(POSTS))
    const options = { fetchUpstream: upstream, cache, now: () => now }
    await proxyOasaWeb(request('/oasa-web/wp-json/wp/v2/posts'), undefined, options)
    now += 4 * 60_000
    const cached = await proxyOasaWeb(request('/oasa-web/wp-json/wp/v2/posts'), undefined, options)
    expect(upstream).toHaveBeenCalledTimes(1)
    expect(await cached.text()).toBe(POSTS)
    expect(cached.headers.get('x-fetched-at')).toBe('1000000')
    // The first page is fresh for 5 minutes
    now += 2 * 60_000
    await proxyOasaWeb(request('/oasa-web/wp-json/wp/v2/posts'), undefined, options)
    expect(upstream).toHaveBeenCalledTimes(2)
  })

  it('keeps the copy without oasa.gr’s cookie, for a day', async () => {
    const cache = fakeCache()
    await proxyOasaWeb(request('/oasa-web/wp-json/wp/v2/posts'), undefined, { fetchUpstream: async () => ok(POSTS), cache })
    const stored = cache.store.get(LIST_UPSTREAM)!
    expect(stored.headers.get('set-cookie')).toBeNull()
    expect(stored.headers.get('cache-control')).toBe('public, max-age=86400')
  })

  it('serves the saved copy, marked stale, when oasa.gr is down', async () => {
    const cache = fakeCache()
    let now = 0
    await proxyOasaWeb(request('/oasa-web/wp-json/wp/v2/posts'), undefined, { fetchUpstream: async () => ok(POSTS), cache, now: () => now })
    now = 60 * 60_000
    const down = vi.fn(async () => new Response('<html>502</html>', { status: 502 }))
    const res = await proxyOasaWeb(request('/oasa-web/wp-json/wp/v2/posts'), undefined, { fetchUpstream: down, cache, now: () => now })
    expect(down).toHaveBeenCalled()
    expect(res.status).toBe(200)
    expect(res.headers.get('x-stale')).toBe('1')
    expect(await res.text()).toBe(POSTS)
  })

  it('answers 502 when oasa.gr is down and nothing is saved', async () => {
    const unreachable = vi.fn(async () => {
      throw new TypeError('fetch failed')
    })
    const res = await proxyOasaWeb(request('/oasa-web/wp-json/wp/v2/posts'), undefined, { fetchUpstream: unreachable, cache: fakeCache() })
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: 'oasa.gr could not be reached' })
  })

  it('doesn’t keep answers that aren’t posts', async () => {
    const cache = fakeCache()
    const res = await proxyOasaWeb(request('/oasa-web/wp-json/wp/v2/posts'), undefined, {
      fetchUpstream: async () => ok('<html>maintenance</html>'),
      cache,
    })
    expect(res.status).toBe(502)
    expect(cache.store.size).toBe(0)
  })

  it('saves in the background when the Worker gives it a context', async () => {
    const cache = fakeCache()
    const waitUntil = vi.fn()
    await proxyOasaWeb(request('/oasa-web/wp-json/wp/v2/posts'), { waitUntil }, { fetchUpstream: async () => ok(POSTS), cache })
    expect(waitUntil).toHaveBeenCalledWith(expect.any(Promise))
  })
})
