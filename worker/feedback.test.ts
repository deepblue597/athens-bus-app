import { describe, expect, it, vi } from 'vitest'
import { handleFeedback, type FeedbackEnv } from './feedback.ts'

const SITE = 'https://bus.deepblue597.org'
const report = { kind: 'problem', message: 'The map stays blank on the Rail tab', page: '/rail', app: 'Website (abc1234)', device: 'Linux, Firefox 140', website: '' }

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request(`${SITE}/api/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.7', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

const allow = { limit: vi.fn(async () => ({ success: true })) }
const env: FeedbackEnv = { GITHUB_TOKEN: 'token', FEEDBACK_LIMITER: allow }
const github = () => vi.fn(async () => Response.json({ html_url: 'https://github.com/deepblue597/athens-bus-app/issues/42', number: 42 }, { status: 201 }))

describe('handleFeedback', () => {
  it('opens a GitHub issue and answers with its link', async () => {
    const fetchGitHub = github()
    const res = await handleFeedback(post(report, { Origin: SITE }), env, fetchGitHub, () => new Date('2026-10-28T16:05:00Z'))
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ url: 'https://github.com/deepblue597/athens-bus-app/issues/42', number: 42 })
    expect(allow.limit).toHaveBeenCalledWith({ key: '203.0.113.7' })

    const [url, init] = fetchGitHub.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.github.com/repos/deepblue597/athens-bus-app/issues')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token')
    const issue = JSON.parse(init.body as string)
    expect(issue.title).toBe('Problem: The map stays blank on the Rail tab')
    expect(issue.labels).toEqual(['feedback'])
    expect(issue.body).toContain('**Page:** [/rail](https://bus.deepblue597.org/rail)')
  })

  it('takes reports from the Android app, which sends no Origin', async () => {
    expect((await handleFeedback(post(report), env, github())).status).toBe(201)
  })

  it('refuses other methods, other sites and too many reports', async () => {
    const fetchGitHub = github()
    expect((await handleFeedback(new Request(`${SITE}/api/feedback`), env, fetchGitHub)).status).toBe(405)
    expect((await handleFeedback(post(report, { Origin: 'https://evil.example' }), env, fetchGitHub)).status).toBe(403)
    const deny = { limit: vi.fn(async () => ({ success: false })) }
    const limited = await handleFeedback(post(report), { ...env, FEEDBACK_LIMITER: deny }, fetchGitHub)
    expect(limited.status).toBe(429)
    expect(await limited.json()).toEqual({ error: 'Too many reports. Please wait a minute and try again.' })
    expect(fetchGitHub).not.toHaveBeenCalled()
  })

  it('refuses reports it cannot read or that are too short or too big', async () => {
    const fetchGitHub = github()
    expect((await handleFeedback(post('{not json'), env, fetchGitHub)).status).toBe(400)
    const short = await handleFeedback(post({ ...report, message: 'bad' }), env, fetchGitHub)
    expect(short.status).toBe(400)
    expect(await short.json()).toEqual({ error: 'Please write at least 10 characters.' })
    expect((await handleFeedback(post({ ...report, message: 'x'.repeat(20_000) }), env, fetchGitHub)).status).toBe(413)
    expect(fetchGitHub).not.toHaveBeenCalled()
  })

  it('pretends to accept reports from bots, without opening an issue', async () => {
    const fetchGitHub = github()
    const res = await handleFeedback(post({ ...report, website: 'https://spam.example' }), env, fetchGitHub)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ url: null })
    expect(fetchGitHub).not.toHaveBeenCalled()
  })

  it('answers 503 without a token and 502 when GitHub fails', async () => {
    expect((await handleFeedback(post(report), { FEEDBACK_LIMITER: allow }, github())).status).toBe(503)
    const failing = vi.fn(async () => new Response('Bad credentials', { status: 401 }))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await handleFeedback(post(report), env, failing)).status).toBe(502)
    const unreachable = vi.fn(async () => {
      throw new TypeError('fetch failed')
    })
    expect((await handleFeedback(post(report), env, unreachable)).status).toBe(502)
  })
})
