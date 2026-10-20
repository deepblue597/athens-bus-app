import { useParams } from 'react-router'

// P2: timetable and route shape for this line
export function LinePage() {
  const { lineId } = useParams()
  return (
    <section className="page">
      <h1>Line {lineId}</h1>
      <p>The timetable will appear here.</p>
    </section>
  )
}
