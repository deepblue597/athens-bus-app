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
| `npm run build:stops` | Rebuild `public/data/stops.json` from the live API (also runs nightly on GitHub) |
| `npm run test:live` | Run the smoke tests against the real OASA API |

## How it works

There is no backend of our own. OASA only allows cross-origin requests on some endpoints, so the app
calls `/oasa/*` on its own origin and a thin proxy forwards them to the OASA API (Vite's proxy in
development; a Cloudflare Pages Function in production, to be added with deployment).
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

## Roadmap

- [x] Project setup: map of Athens, routes, data layer
- [x] **P1:** nearby stops from your location, live arrivals at a stop
- [x] **P2:** line search, timetables, route shapes on the map
- [x] **P3:** all stops on the map (rebuilt nightly from the API), offline support, installable app, favourites
- [ ] **P4:** live bus positions, phone app (Capacitor)

## License

MIT. See [LICENSE](LICENSE).

## Data

Bus data © OASA. Map tiles by [OpenFreeMap](https://openfreemap.org), map data © OpenStreetMap contributors.
