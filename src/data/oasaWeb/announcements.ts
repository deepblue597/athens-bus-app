import type { Announcement, AnnouncementsPage } from '../../domain/announcement'
import { getJson, isNativeApp } from '../oasa/client'
import { toAnnouncement, toAnnouncementsPage } from './announcementAdapters'
import { POSTS_PATH, postQuery, postsListQuery } from './postsQuery'

/**
 * Like telematics (see client.ts), the Android app asks www.oasa.gr directly through native HTTP; the
 * website asks its own origin, where the Worker (worker/oasaWebProxy.ts) caches oasa.gr's answers.
 */
const POSTS_URL = (isNativeApp ? 'https://www.oasa.gr' : '/oasa-web') + POSTS_PATH

// oasa.gr's API takes ~1-2 s; the Worker gives up on it after 8 s and then serves a saved copy
const TIMEOUT_MS = 10_000

/** A page of announcements, newest first, published before the `before` cursor if given */
export async function fetchAnnouncements(before: string | null): Promise<AnnouncementsPage> {
  return toAnnouncementsPage(await getJson(POSTS_URL + postsListQuery(before), TIMEOUT_MS))
}

export async function fetchAnnouncement(id: number): Promise<Announcement> {
  return toAnnouncement(await getJson(`${POSTS_URL}/${id}${postQuery()}`, TIMEOUT_MS))
}
