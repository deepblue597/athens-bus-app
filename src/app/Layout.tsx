import { NavLink, Outlet } from 'react-router'
import './Layout.css'

export function Layout() {
  return (
    <div className="layout">
      <header className="layout-header">
        <NavLink to="/" className="layout-title">
          Athens Bus
        </NavLink>
      </header>
      <main className="layout-main">
        <Outlet />
      </main>
    </div>
  )
}
