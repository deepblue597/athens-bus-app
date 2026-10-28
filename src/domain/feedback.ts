// A report from the "Report a problem" page, which the Worker (worker/feedback.ts) turns into a public
// GitHub issue. Shared by the page and the Worker, so both check the same limits.

export const FEEDBACK_KINDS = {
  problem: { label: 'Something doesn’t work', title: 'Problem' },
  data: { label: 'Wrong or missing information (an arrival, a stop, a timetable)', title: 'Wrong info' },
  idea: { label: 'An idea or a request', title: 'Idea' },
} as const

export type FeedbackKind = keyof typeof FEEDBACK_KINDS

export const MESSAGE_MIN = 10
export const MESSAGE_MAX = 2000

export interface Feedback {
  kind: FeedbackKind
  message: string
  /** The app page the report was sent from, e.g. /stop/60134 */
  page: string | null
  /** e.g. "Android app 1.6 (fe99493)" or "Website (fe99493)" */
  app: string
  /** e.g. "Android 14, Chrome 130" */
  device: string
}

export type ParsedFeedback = { ok: true; feedback: Feedback } | { ok: false; error: string } | { ok: false; spam: true }

/** App paths only (no query string), so a page is safe to put in a link */
const PAGE_PATTERN = /^\/[A-Za-z0-9/_-]{0,100}$/
const LABEL_PATTERN = /^[A-Za-z0-9 .,()/_-]{1,80}$/

export function cleanPage(page: unknown): string | null {
  return typeof page === 'string' && PAGE_PATTERN.test(page) && page !== '/feedback' ? page : null
}

function cleanLabel(value: unknown): string {
  return typeof value === 'string' && LABEL_PATTERN.test(value) ? value : 'unknown'
}

/** Line breaks as \n, and no control characters other than line breaks and tabs */
export function cleanMessage(message: string): string {
  // eslint-disable-next-line no-control-regex
  return message.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim()
}

/**
 * Checks a report sent to the Worker. `website` is a field people never see: bots that fill in every
 * field fill it in too, and their report is dropped.
 */
export function parseFeedback(body: unknown): ParsedFeedback {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'The report is empty.' }
  }
  const b = body as Record<string, unknown>
  if (typeof b.website === 'string' && b.website !== '') {
    return { ok: false, spam: true }
  }
  if (typeof b.kind !== 'string' || !Object.hasOwn(FEEDBACK_KINDS, b.kind)) {
    return { ok: false, error: 'Choose what the report is about.' }
  }
  const message = typeof b.message === 'string' ? cleanMessage(b.message) : ''
  if (message.length < MESSAGE_MIN) {
    return { ok: false, error: `Please write at least ${MESSAGE_MIN} characters.` }
  }
  if (message.length > MESSAGE_MAX) {
    return { ok: false, error: `Please keep it under ${MESSAGE_MAX} characters.` }
  }
  return {
    ok: true,
    feedback: { kind: b.kind as FeedbackKind, message, page: cleanPage(b.page), app: cleanLabel(b.app), device: cleanLabel(b.device) },
  }
}

const TITLE_LENGTH = 70

export function issueTitle(f: Feedback): string {
  const firstLine = f.message.split('\n')[0].replace(/\s+/g, ' ').trim()
  const text = firstLine.length > TITLE_LENGTH ? `${firstLine.slice(0, TITLE_LENGTH - 1).trimEnd()}…` : firstLine
  return `${FEEDBACK_KINDS[f.kind].title}: ${text}`
}

/**
 * The issue's text. The message goes in a code block, so nothing in it is read as Markdown: no
 * @mentions that notify people, no images loaded from elsewhere, no links. Long lines are wrapped,
 * because GitHub doesn't wrap code blocks.
 */
export function issueBody(f: Feedback, siteOrigin: string, sentAt: Date): string {
  const longestTicks = Math.max(0, ...(f.message.match(/`+/g) ?? []).map((t) => t.length))
  const fence = '`'.repeat(Math.max(3, longestTicks + 1))
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Athens', dateStyle: 'medium', timeStyle: 'short' }).format(sentAt)
  return [
    `**About:** ${FEEDBACK_KINDS[f.kind].label}`,
    `**Page:** ${f.page ? `[${f.page}](${siteOrigin}${f.page})` : 'not given'}`,
    `**App:** ${f.app}`,
    `**Device:** ${f.device}`,
    `**Sent:** ${time} (Athens time)`,
    '',
    `${fence}text`,
    wrapLines(f.message, 100),
    fence,
    '',
    '<sub>Sent anonymously from the app’s “Report a problem” page.</sub>',
  ].join('\n')
}

export function wrapLines(text: string, width: number): string {
  return text
    .split('\n')
    .flatMap((line) => {
      const out: string[] = []
      let rest = line
      while (rest.length > width) {
        const space = rest.lastIndexOf(' ', width)
        const cut = space > 0 ? space : width
        out.push(rest.slice(0, cut).trimEnd())
        rest = rest.slice(cut).trimStart()
      }
      out.push(rest)
      return out
    })
    .join('\n')
}

/** A short description of the browser, e.g. "Android 14, Chrome 130", with no device model */
export function describeDevice(userAgent: string): string {
  const os =
    match(userAgent, /Android (\d+(?:\.\d+)?)/, 'Android') ??
    match(userAgent, /(?:iPhone|CPU) OS (\d+)/, 'iOS') ??
    (/CrOS/.test(userAgent) ? 'ChromeOS' : null) ??
    (/Windows/.test(userAgent) ? 'Windows' : null) ??
    (/Mac OS X/.test(userAgent) ? 'macOS' : null) ??
    (/Linux/.test(userAgent) ? 'Linux' : null) ??
    'unknown system'
  const browser =
    match(userAgent, /Edg[A-Za-z]*\/(\d+)/, 'Edge') ??
    match(userAgent, /SamsungBrowser\/(\d+)/, 'Samsung Internet') ??
    match(userAgent, /(?:Firefox|FxiOS)\/(\d+)/, 'Firefox') ??
    match(userAgent, /CriOS\/(\d+)/, 'Chrome') ??
    (/; wv\)/.test(userAgent) ? match(userAgent, /Chrome\/(\d+)/, 'WebView') : null) ??
    match(userAgent, /Chrome\/(\d+)/, 'Chrome') ??
    match(userAgent, /Version\/(\d+)[^ ]* (?:Mobile\/\S+ )?Safari/, 'Safari') ??
    'unknown browser'
  return `${os}, ${browser}`
}

function match(text: string, pattern: RegExp, name: string): string | null {
  const m = pattern.exec(text)
  return m ? `${name} ${m[1]}` : null
}
