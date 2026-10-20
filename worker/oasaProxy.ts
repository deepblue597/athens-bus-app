// Production version of the Vite dev proxy (vite.config.ts): /oasa/api/?act=... → telematics.oasa.gr.
// OASA only sends CORS headers on some endpoints and only accepts connections from Greece; Cloudflare
// runs the Worker in the data centre that received the request, which is Athens for users in Greece.

const UPSTREAM = 'https://telematics.oasa.gr/api/'
const TIMEOUT_MS = 8000

/**
 * The calls the app makes, with how long Cloudflare's edge may cache each answer (seconds).
 * Anything else is refused, so this can't be used as an open proxy.
 */
export const CACHE_SECONDS: Record<string, number> = {
  getStopArrivals: 5,
  getBusLocation: 5,
  getClosestStops: 60,
  getDailySchedule: 600,
  getSchedLines: 600,
  getScheduleDaysMasterline: 3600,
  webGetLinesWithMLInfo: 3600,
  webGetRoutes: 3600,
  webGetRoutesDetailsAndStops: 3600,
  webRoutesForStop: 3600,
}

type CloudflareRequestInit = RequestInit & { cf?: { cacheTtl: number; cacheEverything: boolean } }

export async function proxyOasa(request: Request, fetchUpstream: typeof fetch = fetch): Promise<Response> {
  if (request.method !== 'GET') {
    return errorResponse(405, 'Method not allowed')
  }
  const url = new URL(request.url)
  if (url.pathname !== '/oasa/api/' && url.pathname !== '/oasa/api') {
    return errorResponse(404, 'Not found')
  }
  const act = url.searchParams.get('act') ?? ''
  const cacheSeconds = CACHE_SECONDS[act]
  if (cacheSeconds === undefined) {
    return errorResponse(400, 'Unsupported request')
  }

  const init: CloudflareRequestInit = {
    headers: { 'User-Agent': 'athens-bus-app (+https://bus.deepblue597.org)' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    // Many people watching the same stop cost OASA one request per few seconds
    cf: { cacheTtl: cacheSeconds, cacheEverything: true },
  }
  let upstream: Response
  try {
    upstream = await fetchUpstream(UPSTREAM + url.search, init)
  } catch {
    // Timeouts and refused connections (e.g. when Cloudflare serves the request from outside Greece)
    return errorResponse(502, 'OASA could not be reached')
  }
  if (!upstream.ok) {
    return errorResponse(502, `OASA answered ${upstream.status}`)
  }
  return new Response(upstream.body, {
    status: 200,
    headers: {
      // OASA labels its JSON as text/html
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, max-age=${cacheSeconds}`,
    },
  })
}

function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}
