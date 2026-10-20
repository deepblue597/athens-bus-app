import { APIHelpers, APIRequests, type RequestFunction } from 'oasa-telematics-api'

const TIMEOUT_MS = 8000
const RETRIES = 1

// OASA has no uptime guarantee: give up on slow requests and retry once before failing
const resilientRequest: RequestFunction = async <T>(url: string, query: string): Promise<T> => {
  let lastError: unknown
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(url + query, { signal: AbortSignal.timeout(TIMEOUT_MS) })
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
