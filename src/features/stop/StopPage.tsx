import { useParams } from 'react-router'

// P1: live arrivals for this stop
export function StopPage() {
  const { stopCode } = useParams()
  return (
    <section className="page">
      <h1>Stop {stopCode}</h1>
      <p>Live arrivals will appear here.</p>
    </section>
  )
}
