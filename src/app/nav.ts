// The app's main tabs and which one a page belongs to. Shared by the nav bar and Android's back button.

export type Section = 'nearby' | 'lines' | 'news'

export interface NavItem {
  section: Section
  to: string
  label: string
}

export const NAV: NavItem[] = [
  { section: 'nearby', to: '/', label: 'Nearby' },
  { section: 'lines', to: '/lines', label: 'Lines' },
  // OASA's announcements (detours, closures, strikes)
  { section: 'news', to: '/news', label: 'News' },
]

/**
 * The tab a page belongs to, or null for pages outside the tabs (the /app download page).
 * Stops are reached from Nearby and line timetables from Lines. A route page belongs to Lines when it
 * was opened from a timetable, otherwise to Nearby (from a stop, or opened from a shared link).
 */
export function activeSection(pathname: string, state: unknown): Section | null {
  if (pathname === '/' || pathname.startsWith('/stop/')) {
    return 'nearby'
  }
  if (pathname === '/lines' || pathname.startsWith('/line/')) {
    return 'lines'
  }
  if (pathname === '/news' || pathname.startsWith('/news/')) {
    return 'news'
  }
  if (pathname.startsWith('/route/')) {
    const fromLine = (state as { fromLine?: unknown } | null)?.fromLine
    return fromLine ? 'lines' : 'nearby'
  }
  return null
}

/** True on a tab's own page, as opposed to a page inside it. */
export function isTabPage(pathname: string): boolean {
  return NAV.some((item) => item.to === pathname)
}

export function sectionPath(section: Section): string {
  return NAV.find((item) => item.section === section)!.to
}
