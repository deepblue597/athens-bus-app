# Athens Bus

A web app for Athens buses: nearby stops, live arrivals, line timetables and a map of stops.
It uses the public [OASA telematics API](https://telematics.oasa.gr) through
[oasa-telematics-api](https://github.com/deepblue597/oasa-telematics-api).

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
src/
  app/        Providers, router, layout, offline status
  domain/     The app's own types and logic (Stop, Arrival, search, time...)
  data/       Stops file, favourites; data/oasa/: OASA client and adapters
  features/   One folder per feature: nearby, stop, line, route, map, favourites
```

## Deployment

The site runs on **Cloudflare Workers** at https://bus.deepblue597.org (config in `wrangler.jsonc`): the
built app in `dist/` is served as static assets, and a small Worker (`worker/index.ts`) handles only
`/oasa/*`, proxying the OASA API (logic and tests in `worker/oasaProxy.ts`). It forwards only the calls
the app makes and lets Cloudflare's edge cache
answers for a few seconds (arrivals, bus positions) up to an hour (lines, routes). OASA only accepts
connections from Greece; Cloudflare runs the function in Athens for users there.

- Workers Builds is connected to the GitHub repo: build command `npm run build`, deploy command
  `npx wrangler deploy` (Node version from `.node-version`). Every push to `main` deploys.
- `public/_headers` caches the hashed files in `/assets/` for a year.
- Try the production setup locally: `npm run build && npx wrangler dev`.

## Android app

The same app wrapped with [Capacitor](https://capacitorjs.com) (`capacitor.config.ts`, native project in
`android/`). Inside the app, OASA is called directly through Android's HTTP stack (no proxy, no CORS
limits, and the requests come from the phone), there is no service worker (the files are in the app),
and the stops file ships with the app.

Requirements: Android Studio (it installs the Android SDK in `~/Android/Sdk`) and a full JDK; the
one bundled with Android Studio works (`~/android-studio/jbr`). A Java runtime alone (JRE) can't
compile.

```sh
export ANDROID_HOME=~/Android/Sdk JAVA_HOME=~/android-studio/jbr
npm run build:android                # web build without the service worker, copied into android/
cd android && ./gradlew assembleDebug # APK in android/app/build/outputs/apk/debug/
$ANDROID_HOME/platform-tools/adb install -r app/build/outputs/apk/debug/app-debug.apk  # phone with USB debugging
```

Unlike the website, the app doesn't update itself: after changes, rebuild and reinstall it.

Or open `android/` in Android Studio and press Run.

## Roadmap

- [x] Project setup: map of Athens, routes, data layer
- [x] **P1:** nearby stops from your location, live arrivals at a stop
- [x] **P2:** line search, timetables, route shapes on the map
- [x] **P3:** all stops on the map (rebuilt nightly from the API), offline support, installable app, favourites
- [x] **P4a:** live bus positions on the route map
- [x] **P4b:** deployment on Cloudflare Workers
- [ ] **P4c:** Android app (Capacitor)

## License

MIT. See [LICENSE](LICENSE).

## Data

Bus data © OASA. Map tiles by [OpenFreeMap](https://openfreemap.org), map data © OpenStreetMap contributors.
