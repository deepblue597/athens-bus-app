import { Link, Outlet, useLocation } from 'react-router'
import './Layout.css'

const NAV = [
  // Stops are reached from Nearby, line timetables from Lines
  { to: '/', label: 'Nearby', section: /^\/(stop\/.*)?$/ },
  { to: '/lines', label: 'Lines', section: /^\/lines?(\/.*)?$/ },
]

export function Layout() {
  const { pathname } = useLocation()

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
              </Link>
            )
          })}
        </nav>
      </header>
      <main className="layout-main">
        <Outlet />
      </main>
    </div>
  )
}
