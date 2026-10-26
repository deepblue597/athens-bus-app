// /ose/screens/{board} → a Proastiakos station's live departures board at ose.mpass.ltd (OSE's
// station screens). OSE answers any origin, so this is for caching, not CORS: everyone watching a
// station costs OSE one request per CACHE_SECONDS. The upstream URL is rebuilt from the board number
// (src/data/ose/boardQuery.ts), so nothing else can be fetched through it.
import { BOARD_ID_PATTERN, OSE_ORIGIN, boardPath } from '../src/data/ose/boardQuery.ts'

const TIMEOUT_MS = 8000
/** OSE's own screens refresh every 60 s */
export const CACHE_SECONDS = 30

type CloudflareRequestInit = RequestInit & { cf?: { cacheTtl: number; cacheEverything: boolean } }

export async function proxyOse(request: Request, fetchUpstream: typeof fetch = fetch): Promise<Response> {
  if (request.method !== 'GET') {
    return errorResponse(405, 'Method not allowed')
  }
  const match = /^\/ose\/screens\/([^/]+)$/.exec(new URL(request.url).pathname)
  if (!match || !BOARD_ID_PATTERN.test(match[1])) {
    return errorResponse(404, 'Not found')
  }
  const init: CloudflareRequestInit = {
    headers: { 'User-Agent': 'athens-bus-app (+https://bus.deepblue597.org)', Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    // OSE sends no-store; cacheTtl caches the answer at the edge anyway
    cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true },
  }
  let upstream: Response
  try {
    upstream = await fetchUpstream(OSE_ORIGIN + boardPath(Number(match[1])), init)
  } catch {
    return errorResponse(502, 'OSE could not be reached')
  }
  if (!upstream.ok) {
    return errorResponse(upstream.status === 404 ? 404 : 502, `OSE answered ${upstream.status}`)
  }
  return new Response(upstream.body, {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': `public, max-age=${CACHE_SECONDS}` },
  })
}

function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}
