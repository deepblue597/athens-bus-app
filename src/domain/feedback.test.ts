import { describe, expect, it } from 'vitest'
import { cleanPage, describeDevice, issueBody, issueTitle, parseFeedback, wrapLines, type Feedback } from './feedback'

const report: Feedback = {
  kind: 'data',
  message: 'The 040 never came at 18:05\nIt said 2 min for 20 minutes.',
  page: '/stop/60134',
  app: 'Android app 1.6 (fe99493)',
  device: 'Android 14, WebView 130',
}

describe('parseFeedback', () => {
  const valid = { kind: 'problem', message: 'The map stays blank', page: '/rail', app: 'Website (abc1234)', device: 'Linux, Firefox 140', website: '' }

  it('accepts a report and cleans its message', () => {
    expect(parseFeedback({ ...valid, message: '  The map\r\nstays blank\u0007  ' })).toEqual({
      ok: true,
      feedback: { kind: 'problem', message: 'The map\nstays blank', page: '/rail', app: 'Website (abc1234)', device: 'Linux, Firefox 140' },
    })
  })

  it('refuses reports that are too short, too long or of an unknown kind', () => {
    expect(parseFeedback({ ...valid, message: 'broken   ' })).toEqual({ ok: false, error: 'Please write at least 10 characters.' })
    expect(parseFeedback({ ...valid, message: 'x'.repeat(2001) })).toMatchObject({ ok: false })
    expect(parseFeedback({ ...valid, kind: 'toString' })).toMatchObject({ ok: false })
    expect(parseFeedback(null)).toMatchObject({ ok: false })
    expect(parseFeedback('text')).toMatchObject({ ok: false })
  })

  it('drops reports where the hidden field was filled in', () => {
    expect(parseFeedback({ ...valid, website: 'https://spam.example' })).toEqual({ ok: false, spam: true })
  })

  it('replaces a page or labels it cannot trust', () => {
    const parsed = parseFeedback({ ...valid, page: '/stop/1?x=<script>', app: '<img src=x>', device: 42 })
    expect(parsed).toMatchObject({ ok: true, feedback: { page: null, app: 'unknown', device: 'unknown' } })
  })
})

describe('cleanPage', () => {
  it('keeps app paths only', () => {
    expect(cleanPage('/stop/-2')).toBe('/stop/-2')
    expect(cleanPage('/rail/station/tram-zappeio')).toBe('/rail/station/tram-zappeio')
    expect(cleanPage('/')).toBe('/')
    for (const page of ['https://evil.example', '//evil.example', '/stop/1)', '/feedback', '', null, undefined]) {
      expect(cleanPage(page)).toBeNull()
    }
  })
})

describe('issueTitle', () => {
  it('starts with the kind and the first line, shortened', () => {
    expect(issueTitle(report)).toBe('Wrong info: The 040 never came at 18:05')
    const long = issueTitle({ ...report, kind: 'idea', message: 'word '.repeat(40) })
    expect(long.startsWith('Idea: word word')).toBe(true)
    expect(long.endsWith('…')).toBe(true)
    expect(long.length).toBeLessThanOrEqual('Idea: '.length + 70)
  })
})

describe('issueBody', () => {
  it('lists the details and puts the message in a code block', () => {
    const body = issueBody(report, 'https://bus.deepblue597.org', new Date('2026-10-28T16:05:00Z'))
    expect(body).toContain('**Page:** [/stop/60134](https://bus.deepblue597.org/stop/60134)')
    expect(body).toContain('**App:** Android app 1.6 (fe99493)')
    expect(body).toContain('**Sent:** 28 Oct 2026, 18:05 (Athens time)')
    expect(body).toContain('```text\nThe 040 never came at 18:05\nIt said 2 min for 20 minutes.\n```')
  })

  it('uses a longer fence than any in the message, so the message cannot end the block', () => {
    const body = issueBody({ ...report, page: null, message: 'see ``` and @someone ![x](https://t.example/p.png)' }, '', new Date())
    expect(body).toContain('**Page:** not given')
    expect(body).toContain('````text\nsee ``` and @someone')
    expect(body).toMatch(/\n````\n/)
  })
})

describe('wrapLines', () => {
  it('wraps at spaces and breaks words longer than a line', () => {
    expect(wrapLines('aaa bbb ccc', 7)).toBe('aaa bbb\nccc')
    expect(wrapLines('abcdefghij', 4)).toBe('abcd\nefgh\nij')
    expect(wrapLines('short\n\nlines', 10)).toBe('short\n\nlines')
  })
})

describe('describeDevice', () => {
  it('names the system and browser without the phone model', () => {
    expect(
      describeDevice(
        'Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.58 Mobile Safari/537.36',
      ),
    ).toBe('Android 14, WebView 130')
    expect(
      describeDevice('Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'),
    ).toBe('Android 10, Chrome 131')
    expect(
      describeDevice(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('iOS 18, Safari 18')
    expect(describeDevice('Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0')).toBe('Linux, Firefox 140')
    expect(
      describeDevice(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
      ),
    ).toBe('Windows, Edge 131')
    expect(describeDevice('curl/8.0')).toBe('unknown system, unknown browser')
  })
})
