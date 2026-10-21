import { useSyncExternalStore } from 'react'
import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { fetchAnnouncement, fetchAnnouncements } from '../../data/oasaWeb/announcements'
import { getNewsSeenUntil, subscribeNewsSeen } from '../../data/newsSeen'
import type { Announcement, AnnouncementsPage } from '../../domain/announcement'

const ANNOUNCEMENTS_KEY = ['announcements']

/** OASA posts ~3 announcements a day; the Worker caches the first page for 5 minutes too */
const STALE_MS = 5 * 60_000

/** Announcements newest first, 20 at a time ("Load older" fetches the next page) */
export function useAnnouncements() {
  return useInfiniteQuery({
    queryKey: ANNOUNCEMENTS_KEY,
    queryFn: ({ pageParam }) => fetchAnnouncements(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last: AnnouncementsPage) => last.nextBefore,
    staleTime: STALE_MS,
  })
}

/** All loaded announcements, once each: posts published in the same second can repeat across pages */
export function flattenAnnouncements(data: InfiniteData<AnnouncementsPage> | undefined): Announcement[] {
  const seen = new Set<number>()
  return (data?.pages ?? []).flatMap((page) => page.items.filter((a) => !seen.has(a.id) && seen.add(a.id)))
}

/** One announcement: from the list when it's there (also offline), otherwise from oasa.gr */
export function useAnnouncement(id: number) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: ['announcement', id],
    queryFn: () => fetchAnnouncement(id),
    enabled: Number.isSafeInteger(id) && id > 0,
    initialData: () =>
      flattenAnnouncements(queryClient.getQueryData<InfiniteData<AnnouncementsPage>>(ANNOUNCEMENTS_KEY)).find((a) => a.id === id),
    initialDataUpdatedAt: () => queryClient.getQueryState(ANNOUNCEMENTS_KEY)?.dataUpdatedAt,
    staleTime: 60 * 60_000,
  })
}

/** Whether there are announcements newer than the ones last shown on the News tab */
export function useHasUnreadNews(): boolean {
  const seenUntil = useSyncExternalStore(subscribeNewsSeen, getNewsSeenUntil)
  const newest = useAnnouncements().data?.pages[0]?.items[0]?.publishedAt
  return newest !== undefined && (seenUntil === null || newest > seenUntil)
}
