import { Link, Outlet, useLocation } from 'react-router'
import { useHasUnreadNews } from '../features/news/useAnnouncements'
import { useOnline } from './useOnline'
import './Layout.css'

const NAV = [
  // Stops are reached from Nearby, line timetables from Lines
  { to: '/', label: 'Nearby', section: /^\/(stop\/.*)?$/ },
  { to: '/lines', label: 'Lines', section: /^\/lines?(\/.*)?$/ },
  // OASA's announcements (detours, closures, strikes)
  { to: '/news', label: 'News', section: /^\/news(\/.*)?$/ },
]

export function Layout() {
  const { pathname } = useLocation()
  const online = useOnline()
  // Loads the newest announcements on every page, so the tab can show a dot when there are new ones
  const unreadNews = useHasUnreadNews()

  return (
    <div className="layout">
      <header className="layout-header">
        <Link to="/" className="layout-title">
          Athens Bus
        </Link>
        <nav aria-label="Main" className="layout-nav">
          {NAV.map((item) => {
            const active = item.section.test(pathname)
            return (
              <Link
                key={item.to}
                to={item.to}
                className={active ? 'active' : undefined}
                // "page" only on the page itself; "true" marks the section a nested page belongs to
                aria-current={!active ? undefined : pathname === item.to ? 'page' : 'true'}
              >
                {item.label}
                {item.to === '/news' && unreadNews && !active && (
                  <>
                    <span className="nav-dot" aria-hidden="true" />
                    <span className="visually-hidden">, new announcements</span>
                  </>
                )}
              </Link>
            )
          })}
        </nav>
      </header>
      {/* The live region is always present: screen readers miss messages in a region that was hidden */}
      <div role="status">
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
