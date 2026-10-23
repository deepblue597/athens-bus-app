import { Navigate, useParams } from 'react-router'

/** /metro/station/:id, from before the tab became Rail */
export function OldStationLink() {
  const { stationId = '' } = useParams()
  return <Navigate to={`/rail/station/${encodeURIComponent(stationId)}`} replace />
}
