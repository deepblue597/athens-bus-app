// /oasa-web/wp-json/wp/v2/posts[/{id}] → www.oasa.gr's WordPress API, for the News tab.
// Like the telematics proxy it only makes the requests the app needs: the upstream URL is rebuilt
// from fixed values (src/data/oasaWeb/postsQuery.ts), so it can't be used to fetch anything else.
//
// oasa.gr doesn't cache its API (each answer takes ~1-2 s) and sets a cookie, so answers are kept in
// Cloudflare's Cache API instead of using `cf.cacheTtl`: fresh copies are served as they are, and a
// stale copy is served when oasa.gr can't be reached. The Cache API only works on the custom domain
// (it does nothing on *.workers.dev), where every request then goes to oasa.gr.
import { BEFORE_PATTERN, POST_ID_PATTERN, POSTS_PATH, postQuery, postsListQuery } from '../src/data/oasaWeb/postsQuery.ts'

const UPSTREAM = 'https://www.oasa.gr'
const PREFIX = '/oasa-web'
const TIMEOUT_MS = 8000

/** The newest announcements are refetched after this (seconds); older pages and single posts change rarely */
const FRESH_FIRST_PAGE = 5 * 60
const FRESH_OTHER = 60 * 60
/** How long a copy is kept to fall back on when oasa.gr is down */
const KEEP = 24 * 60 * 60
/** Browsers may reuse an answer for this long; the app keeps its own copy too */
const CLIENT_MAX_AGE = 60

export interface EdgeCache {
  match(key: Request): Promise<Response | undefined>
  put(key: Request, response: Response): Promise<void>
}

export interface WaitUntil {
  waitUntil(promise: Promise<unknown>): void
}

interface Options {
  fetchUpstream?: typeof fetch
  cache?: EdgeCache | null
  now?: () => number
}

interface Target {
  kind: 'list' | 'post'
  /** Path and query on oasa.gr */
  query: string
  freshSeconds: number
}

export async function proxyOasaWeb(request: Request, ctx?: WaitUntil, options: Options = {}): Promise<Response> {
  const { fetchUpstream = fetch, cache = defaultCache(), now = Date.now } = options
  if (request.method !== 'GET') {
    return errorResponse(405, 'Method not allowed')
  }
  const target = parseTarget(new URL(request.url))
  if (typeof target === 'number') {
    return errorResponse(target, target === 400 ? 'Unsupported request' : 'Not found')
  }

  const upstreamUrl = UPSTREAM + target.query
  const cacheKey = new Request(upstreamUrl)
  const cached = cache ? await cache.match(cacheKey).catch(() => undefined) : undefined
  const fetchedAt = Number(cached?.headers.get('x-fetched-at'))
  if (cached && now() - fetchedAt < target.freshSeconds * 1000) {
    return toClient(await cached.text(), fetchedAt, false)
  }

  let body: string
  try {
    const upstream = await fetchUpstream(upstreamUrl, {
      headers: { 'User-Agent': 'athens-bus-app (+https://bus.deepblue597.org)', Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (target.kind === 'post' && upstream.status === 404) {
      return errorResponse(404, 'Not found')
    }
    if (!upstream.ok) {
      throw new Error(`oasa.gr answered ${upstream.status}`)
    }
    body = await upstream.text()
    if (!isExpectedJson(body, target.kind)) {
      throw new Error('oasa.gr sent something other than posts')
    }
  } catch (err) {
    if (cached) {
      return toClient(await cached.text(), fetchedAt, true)
    }
    return errorResponse(502, err instanceof Error && err.message.startsWith('oasa.gr') ? err.message : 'oasa.gr could not be reached')
  }

  const time = now()
  if (cache) {
    // Stored without oasa.gr's headers (and its Set-Cookie), kept long enough to fall back on
    const stored = new Response(body, {
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': `public, max-age=${KEEP}`, 'x-fetched-at': String(time) },
    })
    const saving = cache.put(cacheKey, stored).catch(() => {})
    if (ctx) {
      ctx.waitUntil(saving)
    } else {
      await saving
    }
  }
  return toClient(body, time, false)
}

/** The request the app asked for, or the status to refuse it with */
function parseTarget(url: URL): Target | 400 | 404 {
  const path = url.pathname.replace(/\/$/, '')
  if (path === PREFIX + POSTS_PATH) {
    const before = url.searchParams.get('before')
    if (before !== null && !BEFORE_PATTERN.test(before)) {
      return 400
    }
    return { kind: 'list', query: POSTS_PATH + postsListQuery(before), freshSeconds: before ? FRESH_OTHER : FRESH_FIRST_PAGE }
  }
  const id = path.startsWith(PREFIX + POSTS_PATH + '/') ? path.slice((PREFIX + POSTS_PATH + '/').length) : null
  if (id !== null && POST_ID_PATTERN.test(id)) {
    return { kind: 'post', query: `${POSTS_PATH}/${id}${postQuery()}`, freshSeconds: FRESH_OTHER }
  }
  return 404
}

/** A list of posts, or one post. Anything else (an HTML error page, a login wall) isn't kept */
function isExpectedJson(body: string, kind: Target['kind']): boolean {
  try {
    const parsed: unknown = JSON.parse(body)
    return kind === 'list'
      ? Array.isArray(parsed)
      : typeof parsed === 'object' && parsed !== null && typeof (parsed as { id?: unknown }).id === 'number'
  } catch {
    return false
  }
}

function toClient(body: string, fetchedAt: number, stale: boolean): Response {
  const headers: Record<string, string> = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': stale ? 'no-store' : `public, max-age=${CLIENT_MAX_AGE}`,
    'x-fetched-at': String(fetchedAt),
  }
  if (stale) {
    headers['x-stale'] = '1'
  }
  return new Response(body, { status: 200, headers })
}

function defaultCache(): EdgeCache | null {
  // Cloudflare's shared cache; absent outside Workers (tests, Node)
  return (globalThis as { caches?: { default?: EdgeCache } }).caches?.default ?? null
}

function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}
