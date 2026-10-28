import { App } from '@capacitor/app'
import { CapacitorHttp } from '@capacitor/core'
import { describeDevice, type Feedback } from '../domain/feedback'
import { isNativeApp } from './oasa/client'

/** The Android app's page lives on the phone, so it posts to the site (no CORS with native HTTP) */
const FEEDBACK_URL = isNativeApp ? 'https://bus.deepblue597.org/api/feedback' : '/api/feedback'
const TIMEOUT_MS = 15_000

export interface SentFeedback {
  /** The GitHub issue, or null when the Worker didn't say */
  url: string | null
}

/** e.g. "Android app 1.6 (fe99493)" or "Website (fe99493)" */
export async function describeApp(): Promise<string> {
  const build = import.meta.env.VITE_APP_BUILD ?? 'dev'
  if (isNativeApp) {
    const { version } = await App.getInfo().catch(() => ({ version: '?' }))
    return `Android app ${version} (${build})`
  }
  const installed = window.matchMedia('(display-mode: standalone)').matches
  return `${installed ? 'Installed website' : 'Website'} (${build})`
}

export function deviceDescription(): string {
  return describeDevice(navigator.userAgent)
}

/** Sends a report; throws an Error whose message can be shown to the person */
export async function sendFeedback(report: Feedback & { website: string }): Promise<SentFeedback> {
  let status: number
  let data: unknown
  try {
    if (isNativeApp) {
      const res = await CapacitorHttp.post({
        url: FEEDBACK_URL,
        headers: { 'Content-Type': 'application/json' },
        data: report,
        responseType: 'text',
        connectTimeout: TIMEOUT_MS,
        readTimeout: TIMEOUT_MS,
      })
      status = res.status
      data = typeof res.data === 'string' ? JSON.parse(res.data || 'null') : res.data
    } else {
      const res = await fetch(FEEDBACK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      status = res.status
      data = await res.json().catch(() => null)
    }
  } catch {
    throw new Error('Couldn’t send the report. Check your connection and try again.')
  }
  const body = (data ?? {}) as { url?: unknown; error?: unknown }
  if (status >= 200 && status < 300) {
    return { url: typeof body.url === 'string' ? body.url : null }
  }
  // The Worker's messages for reports it won't take (too short, too many) are written for people
  if ((status === 400 || status === 429) && typeof body.error === 'string') {
    throw new Error(body.error)
  }
  throw new Error('Couldn’t send the report right now. Please try again later.')
}
