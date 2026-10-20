import { useState } from 'react'
import { Link } from 'react-router'
import { Capacitor } from '@capacitor/core'
import './AndroidAppBanner.css'

const DISMISSED_KEY = 'athens-bus:app-banner-dismissed'

function shouldShow(): boolean {
  if (Capacitor.isNativePlatform() || !/Android/i.test(navigator.userAgent)) {
    return false
  }
  try {
    return localStorage.getItem(DISMISSED_KEY) === null
  } catch {
    return true
  }
}

/** Offers the Android app to people using the website on an Android phone; dismissing it is remembered */
export function AndroidAppBanner() {
  const [visible, setVisible] = useState(shouldShow)
  if (!visible) {
    return null
  }
  const dismiss = () => {
    setVisible(false)
    try {
      localStorage.setItem(DISMISSED_KEY, '1')
    } catch {
      // Storage blocked: the banner comes back next visit
    }
  }
  return (
    <div className="app-banner">
      <img src="/pwa-192.png" alt="" width="32" height="32" />
      <p>
        <Link to="/app">Get the Android app</Link>
        <span>Faster, and live data works everywhere in Greece</span>
      </p>
      <button type="button" className="app-banner-close" aria-label="Dismiss" onClick={dismiss}>
        <span aria-hidden="true">×</span>
      </button>
    </div>
  )
}
