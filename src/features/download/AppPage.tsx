import { Link } from 'react-router'
import { CERT_SHA256, LATEST_APK_URL, SOURCE_URL, useLatestRelease } from './release'
import './AppPage.css'

// Taken in the Android app (1080 × 2400, saved at 720 × 1600)
const SCREENSHOTS = [
  { file: 'nearby', caption: 'Stops near you' },
  { file: 'arrivals', caption: 'Live arrivals' },
  { file: 'buses', caption: 'Live buses on the map' },
  { file: 'timetable', caption: 'Timetables' },
  { file: 'rail', caption: 'Metro and tram' },
  { file: 'station', caption: 'Next trains and trams' },
]

export function AppPage() {
  const release = useLatestRelease().data

  return (
    <article className="app-page">
      <title>Get the Android app · Athens Bus</title>

      <header className="app-hero">
        <img src="/pwa-192.png" alt="" width="72" height="72" className="app-hero-icon" />
        <h1>Athens Bus for Android</h1>
        <p className="app-hero-lead">
          Nearby stops, live arrivals, timetables and live bus positions for Athens, plus the metro and tram. Free, no
          ads, no account.
        </p>
        <a className="download-button" href={LATEST_APK_URL}>
          Download for Android
        </a>
        <p className="download-meta">
          {release && `Version ${release.version} · ${release.sizeMb ? `${release.sizeMb.toFixed(1)} MB · ` : ''}`}Android 7 or
          newer
        </p>
        <p className="app-alt">
          No Android phone? <Link to="/">Use it in your browser</Link> and add it to your home screen.
        </p>
      </header>

      <section aria-labelledby="screens-heading">
        <h2 id="screens-heading" className="visually-hidden">
          Screenshots
        </h2>
        <ul className="app-screens">
          {SCREENSHOTS.map((s) => (
            <li key={s.file}>
              <figure>
                <img src={`/app/screenshot-${s.file}.jpg`} alt={s.caption} width="360" height="800" loading="lazy" />
                <figcaption>{s.caption}</figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="features-heading">
        <h2 id="features-heading">What it does</h2>
        <ul className="app-features">
          <li>
            <strong>Stops near you</strong>, on a map with every stop in Athens
          </li>
          <li>
            <strong>Live arrivals</strong> at any stop, refreshed every 20 seconds
          </li>
          <li>
            <strong>Live buses on the map</strong>, with the one coming to your stop highlighted
          </li>
          <li>
            <strong>Timetables</strong> for every line: today, weekdays and weekends
          </li>
          <li>
            <strong>Metro and tram</strong> on a map, with positions estimated from STASY’s timetable, and the next
            departures at every station
          </li>
          <li>
            <strong>Favourite stops</strong> and line search in Greek or English
          </li>
          <li>
            <strong>Works offline</strong> for stops and timetables you have opened
          </li>
        </ul>
      </section>

      <section aria-labelledby="install-heading">
        <h2 id="install-heading">Installing</h2>
        <ol className="app-steps">
          <li>Tap <strong>Download for Android</strong> on your phone.</li>
          <li>
            Open the downloaded file. Chrome may warn that this type of file can harm your device: that is shown for every app
            from outside the Play Store. Tap <strong>Download anyway</strong>.
          </li>
          <li>
            When Android asks, allow <strong>Install unknown apps</strong> for your browser or file manager.
          </li>
          <li>
            Tap <strong>Install</strong>, then open Athens Bus.
          </li>
        </ol>
        <p>To update, download the new version and install it over the old one. Your favourites stay.</p>
      </section>

      <section aria-labelledby="privacy-heading">
        <h2 id="privacy-heading">Permissions and privacy</h2>
        <ul className="app-features">
          <li>
            <strong>Location</strong>, only to find stops near you. Your position is sent to OASA’s public API for that and is
            not stored or sent anywhere else. You can allow approximate location only, or none at all.
          </li>
          <li>
            <strong>Internet</strong>, to get live data from OASA and the map.
          </li>
          <li>No account, no ads and no tracking in the app. Favourites stay on your phone.</li>
          <li>
            <strong>Report a problem</strong> sends only what you write, the page you were on, the app version and your
            Android version, and publishes it as an issue on GitHub. Nothing is sent unless you send a report.
          </li>
        </ul>
      </section>

      <section aria-labelledby="verify-heading">
        <h2 id="verify-heading">Checking the download</h2>
        <p>
          The app is signed by <strong>deepblue597</strong>. Updates only install if they carry the same signature. The
          certificate’s SHA-256 fingerprint is:
        </p>
        <code className="app-fingerprint">{CERT_SHA256}</code>
        <p>
          You can compare it with <code>apksigner verify --print-certs athens-bus.apk</code>.
        </p>
      </section>

      <footer className="app-footer">
        <p>
          Unofficial app, not affiliated with OASA. Bus data © OASA. Map data © OpenStreetMap contributors, map tiles by
          OpenFreeMap.
        </p>
        <p>
          <a href={SOURCE_URL}>Source code on GitHub</a> (MIT licence)
        </p>
      </footer>
    </article>
  )
}
