import { APIHelpers, APIRequests, type RequestFunction } from 'oasa-telematics-api'

// OASA only sends CORS headers on some endpoints, so the browser can't call it directly.
// Requests go to our own origin instead, which proxies them to telematics.oasa.gr
// (Vite's proxy in development, see vite.config.ts).
const API_BASE: string = import.meta.env.VITE_OASA_API_BASE ?? '/oasa/api/?act='

// Responses take ~0.1-0.3 s; this shows an error within ~10 s instead of waiting on a dead server
const TIMEOUT_MS = 5000
const RETRIES = 1

/**
 * Stop and route codes are numeric. The library puts them in the query string without encoding,
 * so a crafted link such as /stop/1&p1=2 could otherwise add parameters to the OASA request.
 */
export function isOasaCode(code: string): boolean {
  return /^\d{1,10}$/.test(code)
}

// OASA has no uptime guarantee: give up on slow requests and retry once before failing.
// The library passes its own (cross-origin) base URL, which is ignored in favour of API_BASE.
const resilientRequest: RequestFunction = async <T>(_url: string, query: string): Promise<T> => {
  let lastError: unknown
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(API_BASE + query, { signal: AbortSignal.timeout(TIMEOUT_MS) })
      if (!res.ok) {
        throw new Error(`OASA request "${query}" failed with status ${res.status}`)
      }
      return (await res.json()) as T
    } catch (err) {
      lastError = err
    }
  }
  throw lastError
}

export const oasaApi = new APIRequests(resilientRequest)
export const oasaHelpers = new APIHelpers(resilientRequest)
