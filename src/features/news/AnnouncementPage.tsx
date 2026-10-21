import { useMemo } from 'react'
import { Link, useParams } from 'react-router'
import { HttpError } from '../../data/oasa/client'
import { sanitizeHtml } from '../../shared/sanitizeHtml'
import { formatNewsDate } from './formatNewsDate'
import { useAnnouncement } from './useAnnouncements'
import './News.css'

export function AnnouncementPage() {
  const { id: idParam = '' } = useParams()
  const id = /^\d{1,9}$/.test(idParam) ? Number(idParam) : NaN
  const { data: announcement, isPending, isPaused, isError, error, refetch } = useAnnouncement(id)
  const body = useMemo(() => (announcement ? sanitizeHtml(announcement.html, announcement.url) : ''), [announcement])
  const notFound = Number.isNaN(id) || (error instanceof HttpError && error.status === 404)
  const oasaUrl = announcement?.url ?? (Number.isNaN(id) ? null : `https://www.oasa.gr/?p=${id}`)

  return (
    <article className="news-page news-article">
      <title>{`${announcement?.title ?? 'Announcement'} · Athens Bus`}</title>
      <Link to="/news" className="news-back">
        <span aria-hidden="true">←</span> News
      </Link>

      {announcement ? (
        <>
          <h1 className="news-article-title" lang="el">
            {announcement.title}
          </h1>
          <p className="news-article-meta">
            <time dateTime={new Date(announcement.publishedAt).toISOString()}>{formatNewsDate(announcement.publishedAt)}</time>
            {announcement.updatedAt - announcement.publishedAt > 60_000 && (
              <>
                {' · Updated '}
                <time dateTime={new Date(announcement.updatedAt).toISOString()}>
                  {formatNewsDate(announcement.updatedAt).replace(/^(Today|Yesterday)/, (word) => word.toLowerCase())}
                </time>
              </>
            )}
          </p>
          <div className="news-body" lang="el" dangerouslySetInnerHTML={{ __html: body }} />
        </>
      ) : (
        <div aria-live="polite" className="news-status">
          {notFound ? (
            <p>This announcement wasn’t found. It may have been removed from oasa.gr.</p>
          ) : isError ? (
            <p>
              Couldn’t load the announcement.{' '}
              <button type="button" className="link-button" onClick={() => refetch()}>
                Try again
              </button>
            </p>
          ) : (
            isPending && <p>{isPaused ? 'This announcement isn’t saved on this device. It will load when you’re back online.' : 'Loading…'}</p>
          )}
        </div>
      )}

      {oasaUrl && !notFound && (
        <p className="news-source">
          Source: ΟΑΣΑ ·{' '}
          <a href={oasaUrl} target="_blank" rel="noopener noreferrer">
            View on oasa.gr
          </a>
        </p>
      )}
    </article>
  )
}
