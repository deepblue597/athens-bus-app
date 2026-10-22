# Athens Bus

A web app for Athens buses: nearby stops, live arrivals, line timetables, a map of stops and OASA's
service announcements, plus the metro lines with train positions estimated from STASY's timetable. It uses the public [OASA telematics API](https://telematics.oasa.gr) through
[oasa-telematics-api](https://github.com/deepblue597/oasa-telematics-api), and the
[announcements on oasa.gr](https://www.oasa.gr/ανακοινώσεις/). Metro timetables come from
[STASY's GTFS feed on data.gov.gr](https://data.gov.gr/dataset/dromologia-statheron-sygkoinonion-metro-isap-tram).

> Work in progress. See the [roadmap](#roadmap).

## Getting started

Requires Node.js 20 or newer.

```sh
npm install
npm run dev        # http://localhost:5173
```

| Script | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm test` | Run the unit tests (Vitest) |
| `npm run lint` | Lint with oxlint |
| `npm run typecheck` | Type-check the project |
| `npm run build` | Type-check and build for production into `dist/` |
| `npm run build:stops` | Rebuild `public/data/stops.json` from the live API (must run from Greece: OASA blocks other countries) |
| `npm run build:metro` | Rebuild `public/data/metro.json` from STASY's timetable on data.gov.gr |
| `npm run test:live` | Run the smoke tests against the real OASA API |

## How it works

There is no backend of our own. OASA only allows cross-origin requests on some endpoints, so the app
calls `/oasa/*` on its own origin and a thin proxy forwards them to the OASA API (Vite's proxy in
development; a Cloudflare Worker in production).
The list of all stops is a file rebuilt every night from the API by a GitHub Action. The app is
installable and works offline with what you've looked at before. See
[docs/architecture.md](docs/architecture.md) for the decisions and patterns.

```
scripts/      build-stops.ts: crawls the API into public/data/stops.json
              build-metro.ts: STASY's GTFS feed into public/data/metro.json
src/
  app/        Providers, router, layout, offline status
  domain/     The app's own types and logic (Stop, Arrival, search, time...)
  data/       Stops file, favourites; data/oasa/: OASA client and adapters; data/oasaWeb/: announcements
  features/   One folder per feature: nearby, stop, line, route, map, favourites, news, metro
```

## Deployment

The site runs on **Cloudflare Workers** at https://bus.deepblue597.org (config in `wrangler.jsonc`): the
built app in `dist/` is served as static assets, and a small Worker (`worker/index.ts`) handles only
`/oasa/*`, proxying the OASA API (logic and tests in `worker/oasaProxy.ts`). It forwards only the calls
the app makes and lets Cloudflare's edge cache
answers for a few seconds (arrivals, bus positions) up to an hour (lines, routes). OASA only accepts
connections from Greece; Cloudflare runs the function in Athens for users there. It also handles
`/oasa-web/*`, the News tab's requests to www.oasa.gr (`worker/oasaWebProxy.ts`), keeping answers in
Cloudflare's cache and serving a saved copy when oasa.gr is down.

- Workers Builds is connected to the GitHub repo: build command `npm run build`, deploy command
  `npx wrangler deploy` (Node version from `.node-version`). Every push to `main` deploys.
- `public/_headers` caches the hashed files in `/assets/` for a year.
- Try the production setup locally: `npm run build && npx wrangler dev`.

## Android app

The same app wrapped with [Capacitor](https://capacitorjs.com) (`capacitor.config.ts`, native project in
`android/`). Inside the app, OASA is called directly through Android's HTTP stack (no proxy, no CORS
limits, and the requests come from the phone), there is no service worker (the files are in the app),
and the stops file ships with the app.

Requirements: Android Studio (it installs the Android SDK in `~/Android/Sdk`) and a full **JDK 21**
(`sudo apt install openjdk-21-jdk-headless`). A Java runtime alone (JRE) can't compile, and the Java
bundled with recent Android Studio (25) is too new for this project's Gradle 8.

```sh
export ANDROID_HOME=~/Android/Sdk JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
npm run build:android                # web build without the service worker, copied into android/
cd android && ./gradlew assembleDebug # APK in android/app/build/outputs/apk/debug/
$ANDROID_HOME/platform-tools/adb install -r app/build/outputs/apk/debug/app-debug.apk  # phone with USB debugging
```

Unlike the website, the app doesn't update itself: after changes, rebuild and reinstall it.

### Release APK

Release builds are signed with the owner's key, which never goes into git: `android/keystore.properties`
(copy `keystore.properties.example`) points to the key file and holds its passwords. Every update must
be signed with the same key, so the key file and password need a backup.

```sh
keytool -genkeypair -v -keystore ~/keys/athens-bus-release.jks -alias athensbus \
  -keyalg RSA -keysize 4096 -validity 10000          # once
npm run build:android:release                        # android/app/build/outputs/apk/release/app-release.apk
```

Raise `versionCode` (and `versionName`) in `android/app/build.gradle` for each release, or Android
won't install it over the previous one. Without `keystore.properties`, release builds stay unsigned.

Publishing: attach the APK to a GitHub release **named `athens-bus.apk`**, so the download page
(https://bus.deepblue597.org/app) and its "latest" link pick it up. Copy it under that name first:
`gh release create file#name` only sets the asset's display label, and the file keeps its own name.

```sh
cp android/app/build/outputs/apk/release/app-release.apk /tmp/athens-bus.apk
gh release create v1.3 /tmp/athens-bus.apk --title "Athens Bus 1.3" --notes "What changed"
```

Or open `android/` in Android Studio and press Run.

## Roadmap

- [x] Project setup: map of Athens, routes, data layer
- [x] **P1:** nearby stops from your location, live arrivals at a stop
- [x] **P2:** line search, timetables, route shapes on the map
- [x] **P3:** all stops on the map (rebuilt nightly from the API), offline support, installable app, favourites
- [x] **P4a:** live bus positions on the route map
- [x] **P4b:** deployment on Cloudflare Workers
- [ ] **P4c:** Android app (Capacitor)
- [x] **P5:** News tab with OASA's service announcements
- [x] **P6a:** bottom tab bar on phones
- [x] **P6b:** Metro tab: M1–M3 on a map with timetable-estimated train positions, next trains at each station
- [ ] **P6c:** metro stations on the Nearby map, metro disruptions from the News tab, the tram

## License

MIT. See [LICENSE](LICENSE).

## Data

Bus data and announcements © OASA (each announcement links to the original on oasa.gr). Metro
timetables © STASY, published on [data.gov.gr](https://data.gov.gr/dataset/dromologia-statheron-sygkoinonion-metro-isap-tram)
(the dataset states no licence; Greek public-sector open data is reusable under law 4727/2020). Metro
line shapes © OpenStreetMap contributors (ODbL). Map tiles by [OpenFreeMap](https://openfreemap.org), map data © OpenStreetMap contributors.
