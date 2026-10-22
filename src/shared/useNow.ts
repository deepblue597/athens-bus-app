import { useEffect, useState } from 'react'

/** The current time (epoch ms), updated every `intervalMs` while the page is visible */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | undefined
    const stop = () => {
      clearInterval(id)
      id = undefined
    }
    const start = () => {
      stop()
      setNow(Date.now())
      id = setInterval(() => setNow(Date.now()), intervalMs)
    }
    // Nothing to redraw in a hidden tab or a backgrounded app; catch up at once on return
    const onVisibility = () => (document.hidden ? stop() : start())
    if (!document.hidden) {
      start()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [intervalMs])
  return now
}
