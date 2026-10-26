import { useMemo } from 'react'
import { Link } from 'react-router'
import type { MetroNetwork, MetroStation } from '../../domain/metro'
import { railNews } from '../../domain/railNews'
import { formatNewsDate } from '../news/formatNewsDate'
import { flattenAnnouncements, useAnnouncements } from '../news/useAnnouncements'

/** OASA's announcements are about closures that last hours or days; older ones are left to the News tab */
const RECENT_MS = 7 * 24 * 60 * 60_000
const MAX_SHOWN = 4

/**
 * OASA's recent announcements about the metro and tram (closed stations, replacement buses, tram
 * diversions), from the News tab's list: all of them on the Rail tab, the ones naming a station on
 * its page. Shows nothing when there are none, or while the news can't be loaded.
 */
export function RailNewsList({ network, station, now }: { network: MetroNetwork; station?: MetroStation; now: number }) {
  const { data } = useAnnouncements()
  // By the hour, so the list isn't worked out again on every tick of `now`
  const since = Math.floor((now - RECENT_MS) / 3_600_000) * 3_600_000
  const news = useMemo(() => {
    const all = railNews(flattenAnnouncements(data), network, since)
    return (station ? all.filter((n) => n.stations.includes(station.index)) : all).slice(0, MAX_SHOWN)
  }, [data, network, station, since])

  if (news.length === 0) {
    return null
  }
  return (
    <section className="rail-news" aria-labelledby="rail-news-heading">
      <h2 id="rail-news-heading">{station ? 'OASA announcements about this station' : 'OASA announcements'}</h2>
      <ul>
        {news.map(({ announcement: a }) => (
          <li key={a.id}>
            <Link to={`/news/${a.id}`} className="rail-news-item">
              <time className="rail-news-date" dateTime={new Date(a.publishedAt).toISOString()}>
                {formatNewsDate(a.publishedAt)}
              </time>
              <span className="rail-news-title" lang="el">
                {a.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
