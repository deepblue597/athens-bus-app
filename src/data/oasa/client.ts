import { Capacitor, CapacitorHttp } from '@capacitor/core'
import { APIHelpers, APIRequests, type RequestFunction } from 'oasa-telematics-api'

/**
 * In the Android app, requests go straight to OASA through Android's HTTP stack: no CORS limits, and
 * they come from the phone (OASA only accepts connections from Greece). In the browser OASA only
 * sends CORS headers on some endpoints, so requests go to our own origin, which proxies them
 * (Vite's proxy in development, the Cloudflare Worker in production).
 */
export const isNativeApp = Capacitor.isNativePlatform()
const API_BASE: string = isNativeApp
  ? 'https://telematics.oasa.gr/api/?act='
  : (import.meta.env.VITE_OASA_API_BASE ?? '/oasa/api/?act=')

// Responses take ~0.1-0.3 s; this shows an error within ~10 s instead of waiting on a dead server
const TIMEOUT_MS = 5000
const RETRIES = 1

/**
 * Stop and route codes are numeric (one real stop is "-2"). The library puts them in the query string
 * without encoding, so a crafted link such as /stop/1&p1=2 could otherwise add parameters to the request.
 */
export function isOasaCode(code: string): boolean {
  return /^-?\d{1,10}$/.test(code)
}

// OASA has no uptime guarantee: give up on slow requests and retry once before failing.
// The library passes its own (cross-origin) base URL, which is ignored in favour of API_BASE.
const resilientRequest: RequestFunction = async <T>(_url: string, query: string): Promise<T> =>
  (await getJson(API_BASE + query)) as T

/** An HTTP error status, kept so callers can tell "not found" from "down" */
export class HttpError extends Error {
  name = 'HttpError'
  status: number
  constructor(status: number) {
    super(`OASA request failed with status ${status}`)
    this.status = status
  }
}

/**
 * GET and parse JSON, through native HTTP in the Android app. Retries once; a 404 isn't retried.
 * www.oasa.gr's API is slower than telematics (~1-2 s), so it passes a longer timeout.
 */
export async function getJson(url: string, timeoutMs = TIMEOUT_MS): Promise<unknown> {
  let lastError: unknown
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      return await (isNativeApp ? nativeGet(url, timeoutMs) : browserGet(url, timeoutMs))
    } catch (err) {
      lastError = err
      if (err instanceof HttpError && err.status === 404) {
        break
      }
    }
  }
  throw lastError
}

async function browserGet(url: string, timeoutMs: number): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
  if (!res.ok) {
    throw new HttpError(res.status)
  }
  return res.json()
}

async function nativeGet(url: string, timeoutMs: number): Promise<unknown> {
  // OASA labels its JSON as text/html, so ask for text and parse it here
  const res = await CapacitorHttp.get({ url, responseType: 'text', connectTimeout: timeoutMs, readTimeout: timeoutMs })
  if (res.status < 200 || res.status >= 300) {
    throw new HttpError(res.status)
  }
  return typeof res.data === 'string' ? JSON.parse(res.data) : res.data
}

export const oasaApi = new APIRequests(resilientRequest)
export const oasaHelpers = new APIHelpers(resilientRequest)
