import { createBrowserRouter } from 'react-router'
import { Layout } from './Layout'
import { NearbyPage } from '../features/nearby/NearbyPage'
import { StopPage } from '../features/stop/StopPage'
import { LinesPage } from '../features/line/LinesPage'
import { LinePage } from '../features/line/LinePage'
import { RoutePage } from '../features/route/RoutePage'
import { AppPage } from '../features/download/AppPage'

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
      { path: 'app', element: <AppPage /> },
    ],
  },
])
