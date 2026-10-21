// The one oasa.gr request the app makes, shared by the client (src/data/oasaWeb/announcements.ts) and
// the Worker (worker/oasaWebProxy.ts), which rebuilds it from these values instead of forwarding
// whatever it is sent. No imports, so both TypeScript projects can use it.

/** WordPress REST API for posts on www.oasa.gr */
export const POSTS_PATH = '/wp-json/wp/v2/posts'

/** The "Ανακοινώσεις" category: service announcements (closures, detours, strikes) */
export const ANNOUNCEMENTS_CATEGORY = 82

export const PAGE_SIZE = 20

export const POST_FIELDS = 'id,date_gmt,modified_gmt,link,title,content'

/** `before` is a UTC time such as 2026-10-21T09:01:22Z. Without the Z WordPress reads it as Athens time */
export const BEFORE_PATTERN = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/

export const POST_ID_PATTERN = /^\d{1,9}$/

/** Query string for a page of announcements, newest first, published before `before` if given */
export function postsListQuery(before?: string | null): string {
  const params = new URLSearchParams({
    categories: String(ANNOUNCEMENTS_CATEGORY),
    per_page: String(PAGE_SIZE),
    _fields: POST_FIELDS,
  })
  if (before) {
    params.set('before', before)
  }
  return `?${params}`
}

/** Query string for a single post */
export function postQuery(): string {
  return `?${new URLSearchParams({ _fields: POST_FIELDS })}`
}
