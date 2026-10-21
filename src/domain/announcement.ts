/** An OASA service announcement from www.oasa.gr (detours, closures, strikes), in Greek */
export interface Announcement {
  /** WordPress post id; used in URLs (/news/14870) */
  id: number
  /** Epoch ms */
  publishedAt: number
  /** Epoch ms; later than publishedAt when OASA edited it afterwards */
  updatedAt: number
  title: string
  /** Plain-text opening of the body, without OASA's standard first words, for the list */
  summary: string
  /** The body as oasa.gr sends it. Not safe to insert as it is: show it through SafeHtml */
  html: string
  /** The announcement on oasa.gr */
  url: string
}

export interface AnnouncementsPage {
  items: Announcement[]
  /** Cursor for the next (older) page, or null when this was the last one */
  nextBefore: string | null
}
