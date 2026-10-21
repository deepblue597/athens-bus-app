import DOMPurify from 'dompurify'

/**
 * What OASA's announcements use (checked over 100 posts): paragraphs, emphasis, lists, tables and
 * the odd link. Everything else is dropped; wrappers such as <article> and <div> keep their text.
 */
const ALLOWED_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'sup', 'sub', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'a']
const ALLOWED_ATTR = ['href', 'start', 'colspan', 'rowspan']

// DOMPurify hooks are global and sanitize() is synchronous, so the current call's base URL is kept here
let baseForLinks = ''
let hooked = false

function addLinkHook() {
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    // DOMPurify has already removed unsafe hrefs (javascript: and the like)
    const href = node.nodeName === 'A' ? node.getAttribute('href') : null
    if (!href) {
      return
    }
    let url: URL | null = null
    try {
      url = new URL(href, baseForLinks)
    } catch {
      // Not a URL
    }
    if (url && (url.protocol === 'https:' || url.protocol === 'http:')) {
      node.setAttribute('href', url.href)
      node.setAttribute('target', '_blank')
      node.setAttribute('rel', 'noopener noreferrer')
    } else {
      node.removeAttribute('href')
    }
  })
}

/**
 * Makes HTML from another site safe to insert: no scripts, styles, event handlers or other tags.
 * Links are made absolute against `baseUrl`, limited to http(s) and opened outside the app.
 */
export function sanitizeHtml(html: string, baseUrl: string): string {
  if (!hooked) {
    addLinkHook()
    hooked = true
  }
  baseForLinks = baseUrl
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR, ALLOW_DATA_ATTR: false, ALLOW_ARIA_ATTR: false })
}
