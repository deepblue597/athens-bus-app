import { useEffect } from 'react'
import { Link } from 'react-router'
import { markNewsSeen } from '../../data/newsSeen'
import { formatNewsDate } from './formatNewsDate'
import { flattenAnnouncements, useAnnouncements } from './useAnnouncements'
import './News.css'

export const OASA_NEWS_URL = 'https://www.oasa.gr/ανακοινώσεις/'

export function NewsPage() {
  const { data, isPending, isPaused, isError, isRefetchError, isFetchNextPageError, hasNextPage, isFetchingNextPage, fetchNextPage, refetch, dataUpdatedAt } =
    useAnnouncements()
  const announcements = flattenAnnouncements(data)
  const newest = data?.pages[0]?.items[0]?.publishedAt

  // Seeing the list clears the dot on the tab
  useEffect(() => {
    if (newest !== undefined) {
      markNewsSeen(newest)
    }
  }, [newest])

  return (
    <section className="news-page">
      <title>News · Athens Bus</title>
      <h1 className="news-heading">OASA announcements</h1>
      <p className="news-intro">Detours, closures and strikes, as OASA publishes them (in Greek).</p>

      <div aria-live="polite" className="news-status">
        {isPending && (
          <p>{isPaused ? 'Announcements aren’t saved on this device yet. They will load when you’re back online.' : 'Loading announcements…'}</p>
        )}
        {isError && !data && (
          <p>
            Couldn’t load the announcements.{' '}
            <button type="button" className="link-button" onClick={() => refetch()}>
              Try again
            </button>{' '}
            or{' '}
            <a href={OASA_NEWS_URL} target="_blank" rel="noopener noreferrer">
              read them on oasa.gr
            </a>
            .
          </p>
        )}
        {isRefetchError && (
          <p>
            Couldn’t refresh. Showing announcements saved{' '}
            {formatNewsDate(dataUpdatedAt).replace(/^Today, /, 'at ').replace(/^Yesterday/, 'yesterday')}.
          </p>
        )}
      </div>

      {data && announcements.length === 0 && <p className="news-status-text">No announcements right now.</p>}

      <ul className="news-list">
        {announcements.map((a) => (
          <li key={a.id}>
            <Link to={`/news/${a.id}`} className="news-item">
              <time className="news-date" dateTime={new Date(a.publishedAt).toISOString()}>
                {formatNewsDate(a.publishedAt)}
              </time>
              <span className="news-title" lang="el">
                {a.title}
              </span>
              {a.summary && (
                <span className="news-summary" lang="el">
                  {a.summary}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>

      {hasNextPage && (
        <div className="news-more">
          {isFetchNextPageError && <p role="alert">Couldn’t load older announcements.</p>}
          <button type="button" className="news-more-button" disabled={isFetchingNextPage} onClick={() => fetchNextPage()}>
            {isFetchingNextPage ? 'Loading…' : isFetchNextPageError ? 'Try again' : 'Load older'}
          </button>
        </div>
      )}

      {data && (
        <p className="news-source">
          Source:{' '}
          <a href={OASA_NEWS_URL} target="_blank" rel="noopener noreferrer">
            ΟΑΣΑ (oasa.gr)
          </a>
        </p>
      )}
    </section>
  )
}
