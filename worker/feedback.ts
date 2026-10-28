// POST /api/feedback → a public GitHub issue, from the app's "Report a problem" page (web and Android).
// The token (GITHUB_TOKEN, a Worker secret) only needs "Issues: read and write" on this repo. Each
// address may send a few reports a minute (FEEDBACK_LIMITER in wrangler.jsonc); the message is checked
// and put in the issue as plain text (src/domain/feedback.ts).
import { issueBody, issueTitle, parseFeedback } from '../src/domain/feedback.ts'

const REPO = 'deepblue597/athens-bus-app'
const SITE_ORIGIN = 'https://bus.deepblue597.org'
const MAX_BODY_BYTES = 16 * 1024
const TIMEOUT_MS = 10_000

export interface FeedbackEnv {
  GITHUB_TOKEN?: string
  FEEDBACK_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> }
}

export async function handleFeedback(
  request: Request,
  env: FeedbackEnv,
  fetchGitHub: typeof fetch = fetch,
  now: () => Date = () => new Date(),
): Promise<Response> {
  if (request.method !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }
  // Browsers send Origin: only the site itself may post. The Android app's native HTTP sends none.
  const origin = request.headers.get('Origin')
  if (origin !== null && origin !== new URL(request.url).origin) {
    return json(403, { error: 'Not allowed' })
  }
  if (env.FEEDBACK_LIMITER) {
    const { success } = await env.FEEDBACK_LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') ?? 'unknown' })
    if (!success) {
      return json(429, { error: 'Too many reports. Please wait a minute and try again.' })
    }
  }
  const text = await request.text()
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    return json(413, { error: 'The report is too long.' })
  }
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return json(400, { error: 'The report couldn’t be read.' })
  }
  const parsed = parseFeedback(body)
  if (!parsed.ok) {
    // A bot filled in the hidden field: answer as if it worked, so it doesn't try another way
    return 'spam' in parsed ? json(200, { url: null }) : json(400, { error: parsed.error })
  }
  if (!env.GITHUB_TOKEN) {
    return json(503, { error: 'Reports aren’t set up yet.' })
  }

  let res: Response
  try {
    res = await fetchGitHub(`https://api.github.com/repos/${REPO}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'athens-bus-app (+https://bus.deepblue597.org)',
      },
      body: JSON.stringify({
        title: issueTitle(parsed.feedback),
        body: issueBody(parsed.feedback, SITE_ORIGIN, now()),
        labels: ['feedback'],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    return json(502, { error: 'GitHub could not be reached.' })
  }
  if (!res.ok) {
    console.error('GitHub answered', res.status, await res.text().catch(() => ''))
    return json(502, { error: `GitHub answered ${res.status}` })
  }
  const issue = (await res.json()) as { html_url: string; number: number }
  return json(201, { url: issue.html_url, number: issue.number })
}

function json(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}
