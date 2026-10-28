import { Link, Outlet, useLocation } from 'react-router'
import { useHasUnreadNews } from '../features/news/useAnnouncements'
import { activeSection, NAV } from './nav'
import { NavIcon } from './navIcons'
import { useOnline } from './useOnline'
import './Layout.css'

export function Layout() {
  const { pathname, state } = useLocation()
  const online = useOnline()
  // Loads the newest announcements on every page, so the tab can show a dot when there are new ones
  const unreadNews = useHasUnreadNews()
  const current = activeSection(pathname, state)

  return (
    <div className="layout">
      <header className="layout-header">
        <Link to="/" className="layout-title">
          Athens Bus
        </Link>
        {pathname !== '/feedback' && (
          <Link to={`/feedback?from=${encodeURIComponent(pathname)}`} className="layout-feedback">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
              {/* Material Icons "feedback" (Apache-2.0) */}
              <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 12h-2v-2h2v2zm0-4h-2V6h2v4z" />
            </svg>
            <span className="layout-feedback-label">Report a problem</span>
          </Link>
        )}
      </header>
      {/* Same element on every screen size: in the header on wide screens, a bar at the bottom on phones
          (CSS grid moves it), so keyboard and screen-reader order don't change */}
      <nav aria-label="Main" className="layout-nav">
        {NAV.map((item) => {
          const active = item.section === current
          return (
            <Link
              key={item.to}
              to={item.to}
              className={active ? 'active' : undefined}
              // "page" only on the page itself; "true" marks the section a nested page belongs to
              aria-current={!active ? undefined : pathname === item.to ? 'page' : 'true'}
            >
              <span className="nav-icon-wrap">
                <NavIcon section={item.section} />
                {item.section === 'news' && unreadNews && !active && (
                  <span className="nav-dot" aria-hidden="true" />
                )}
              </span>
              <span className="nav-label">{item.label}</span>
              {item.section === 'news' && unreadNews && !active && (
                <span className="visually-hidden">, new announcements</span>
              )}
            </Link>
          )
        })}
      </nav>
      {/* The live region is always present: screen readers miss messages in a region that was hidden */}
      <div role="status" className="layout-status">
        {!online && (
          <p className="offline-banner">
            You’re offline. Saved timetables, routes and stops still work; live arrivals don’t.
          </p>
        )}
      </div>
      <main className="layout-main">
        <Outlet />
      </main>
    </div>
  )
}
