import { createBrowserRouter, Navigate } from 'react-router'
import { Layout } from './Layout'
import { NearbyPage } from '../features/nearby/NearbyPage'
import { StopPage } from '../features/stop/StopPage'
import { LinesPage } from '../features/line/LinesPage'
import { LinePage } from '../features/line/LinePage'
import { RoutePage } from '../features/route/RoutePage'
import { AppPage } from '../features/download/AppPage'
import { NewsPage } from '../features/news/NewsPage'
import { AnnouncementPage } from '../features/news/AnnouncementPage'
import { MetroPage } from '../features/metro/MetroPage'
import { MetroStationPage } from '../features/metro/MetroStationPage'
import { OldStationLink } from '../features/metro/OldStationLink'

// The URL holds what is on screen, so links can be shared and the back button works
export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <NearbyPage /> },
      { path: 'stop/:stopCode', element: <StopPage /> },
      { path: 'lines', element: <LinesPage /> },
      // LineCode, not the line number: several variants share a number (e.g. three lines are "Α7")
      { path: 'line/:lineCode', element: <LinePage /> },
      { path: 'route/:routeCode', element: <RoutePage /> },
      { path: 'rail', element: <MetroPage /> },
      { path: 'rail/station/:stationId', element: <MetroStationPage /> },
      // The tab was "Metro" before the tram joined it: old links and bookmarks still work
      { path: 'metro', element: <Navigate to="/rail" replace /> },
      { path: 'metro/station/:stationId', element: <OldStationLink /> },
      { path: 'news', element: <NewsPage /> },
      { path: 'news/:id', element: <AnnouncementPage /> },
      { path: 'app', element: <AppPage /> },
    ],
  },
])

