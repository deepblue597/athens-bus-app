// @vitest-environment jsdom
// Not happy-dom: its DOM traversal skips nodes, so DOMPurify misses scripts there (real browsers are fine)
import { describe, expect, it } from 'vitest'
import { sanitizeHtml } from './sanitizeHtml'

const BASE = 'https://www.oasa.gr/blog/2026/10/21/post/'

describe('sanitizeHtml', () => {
  it('keeps the formatting OASA uses', () => {
    const html =
      '<p>Γραμμή <strong>060</strong><br><u>Διαδρομή</u> 25<sup>ης</sup></p><ol start="2"><li>Α</li></ol><table><tbody><tr><td colspan="2">490030</td></tr></tbody></table>'
    expect(sanitizeHtml(html, BASE)).toBe(html)
  })

  it('drops scripts, event handlers, styles and unknown attributes', () => {
    const out = sanitizeHtml(
      '<p style="color:red" data-path-to-node="4" onclick="alert(1)">Α</p><script>alert(1)</script><img src=x onerror=alert(1)><iframe src="https://example.com"></iframe>',
      BASE,
    )
    expect(out).toBe('<p>Α</p>')
  })

  it('keeps the text of wrappers it removes', () => {
    expect(sanitizeHtml('<article class="post"><div class="wd-entry-content"><p>Α</p></div></article>', BASE)).toBe('<p>Α</p>')
  })

  it('makes links absolute and opens them outside the app', () => {
    const out = sanitizeHtml('<a href="/lines/" style="x">Γραμμές</a>', BASE)
    expect(out).toBe('<a href="https://www.oasa.gr/lines/" target="_blank" rel="noopener noreferrer">Γραμμές</a>')
  })

  it('removes links that are not http(s)', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>', BASE)).toBe('<a>x</a>')
    expect(sanitizeHtml('<a href="data:text/html,<script>alert(1)</script>">x</a>', BASE)).toBe('<a>x</a>')
  })
})
