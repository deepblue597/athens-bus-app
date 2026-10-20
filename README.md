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

## How it works

There is no backend of our own. OASA only allows cross-origin requests on some endpoints, so the app
calls `/oasa/*` on its own origin and a thin proxy forwards them to the OASA API (Vite's proxy in
development; a Cloudflare Pages Function in production, to be added with deployment).
Static data such as stops and route shapes will come from the official GTFS feed, preprocessed into
small JSON files. See [docs/architecture.md](docs/architecture.md) for the decisions and patterns.

```
src/
  app/        Providers, router, layout
  domain/     The app's own types (Stop, Arrival, ...)
  data/oasa/  OASA client and adapters that turn raw API data into domain types
  features/   One folder per feature: nearby, stop, line, map
```

## Roadmap

- [x] Project setup: map of Athens, routes, data layer
- [x] **P1:** nearby stops from your location, live arrivals at a stop
- [ ] **P2:** ~~route shapes on the map~~ (done), line search, timetables
- [ ] **P3:** all stops on the map (from GTFS), offline support, favourites
- [ ] **P4:** live bus positions, phone app (Capacitor)

## License

MIT. See [LICENSE](LICENSE).

## Data

Bus data © OASA. Map tiles by [OpenFreeMap](https://openfreemap.org), map data © OpenStreetMap contributors.
