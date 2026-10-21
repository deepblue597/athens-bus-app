// Anti-corruption layer for www.oasa.gr's WordPress posts: UTC times without a zone, titles with
// HTML entities, and bodies that are HTML starting with the same formal sentence.
import type { Announcement, AnnouncementsPage } from '../../domain/announcement'
import { PAGE_SIZE } from './postsQuery'

export class OasaWebError extends Error {
  name = 'OasaWebError'
}

/** The fields the app asks for (POST_FIELDS); WordPress may leave any of them out */
export interface RawPost {
  id?: unknown
  date_gmt?: unknown
  modified_gmt?: unknown
  link?: unknown
  title?: { rendered?: unknown }
  content?: { rendered?: unknown }
}

const SITE = 'https://www.oasa.gr/'
const SUMMARY_CHARS = 200

export function toAnnouncementsPage(raw: unknown): AnnouncementsPage {
  if (!Array.isArray(raw)) {
    throw new OasaWebError(`Unexpected oasa.gr response: ${JSON.stringify(raw)?.slice(0, 100)}`)
  }
  const items = raw.map(toAnnouncementOrNull).filter((a): a is Announcement => a !== null)
  // A full page where nothing could be read means the format changed, not that there's no news
  if (raw.length > 0 && items.length === 0) {
    throw new OasaWebError('oasa.gr sent posts in a format the app doesn’t understand')
  }
  const last = raw.at(-1) as RawPost | undefined
  return {
    items,
    // WordPress's `before` is exclusive and in local time unless it ends in Z
    nextBefore: raw.length >= PAGE_SIZE && typeof last?.date_gmt === 'string' ? `${last.date_gmt}Z` : null,
  }
}

export function toAnnouncement(raw: unknown): Announcement {
  const announcement = toAnnouncementOrNull(raw)
  if (!announcement) {
    throw new OasaWebError('oasa.gr sent a post the app doesn’t understand')
  }
  return announcement
}

function toAnnouncementOrNull(raw: unknown): Announcement | null {
  if (typeof raw !== 'object' || raw === null) {
    return null
  }
  const post = raw as RawPost
  const publishedAt = parseUtc(post.date_gmt)
  const title = typeof post.title?.rendered === 'string' ? htmlToText(post.title.rendered) : ''
  if (typeof post.id !== 'number' || publishedAt === null || !title) {
    return null
  }
  const html = typeof post.content?.rendered === 'string' ? post.content.rendered : ''
  return {
    id: post.id,
    publishedAt,
    updatedAt: Math.max(publishedAt, parseUtc(post.modified_gmt) ?? publishedAt),
    title,
    summary: summarise(htmlToText(html)),
    html,
    // Only oasa.gr links: the link ends up in an href
    url: typeof post.link === 'string' && post.link.startsWith(SITE) ? post.link : `${SITE}?p=${post.id}`,
  }
}

/** "2026-10-21T09:01:22" is UTC (date_gmt) but has no zone, so Date.parse would read it as local time */
function parseUtc(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/.test(value)) {
    return null
  }
  const time = Date.parse(`${value}Z`)
  return Number.isNaN(time) ? null : time
}

/**
 * 95 of 100 announcements start "Με στόχο την ενημέρωση και την καλύτερη εξυπηρέτηση του επιβατικού
 * κοινού, ο ΟΑΣΑ ανακοινώνει ότι ..." (sometimes "την έγκυρη ενημέρωση"), so the list shows what
 * comes after it.
 */
const OPENING = /^Με στόχο την [^,]*?εξυπηρέτηση του επιβατικού κοινού\s*,\s*ο ΟΑΣΑ ανακοινώνει(?:\s+ότι)?\s*[,:]?\s*/

export function summarise(text: string): string {
  const rest = text.replace(OPENING, '')
  const capitalised = rest.charAt(0).toLocaleUpperCase('el') + rest.slice(1)
  if (capitalised.length <= SUMMARY_CHARS) {
    return capitalised
  }
  const cut = capitalised.slice(0, SUMMARY_CHARS)
  return `${cut.slice(0, cut.lastIndexOf(' ') > SUMMARY_CHARS / 2 ? cut.lastIndexOf(' ') : SUMMARY_CHARS).trimEnd()}…`
}

/** Plain text of an HTML fragment, without needing a DOM (the adapters also run in tests and Node) */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      // Block ends and line breaks separate words
      .replace(/<(?:br|\/p|\/li|\/td|\/th|\/tr|\/div|\/h\d)\b[^>]*>/gi, ' ')
      .replace(/<[^>]*>/g, ''),
  )
    .replace(/\s+/g, ' ')
    .trim()
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  laquo: '«',
  raquo: '»',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  euro: '€',
}

export function decodeEntities(text: string): string {
  return text.replace(/&(#\d{1,7}|#x[\da-f]{1,6}|[a-z]+);/gi, (entity, name: string) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10)
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity
    }
    return NAMED_ENTITIES[name.toLowerCase()] ?? entity
  })
}
