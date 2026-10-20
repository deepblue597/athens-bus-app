# Architecture

This document records the main decisions for the app and the reasons behind them.

## Decisions

| # | Decision | Reason |
|---|---|---|
| 1 | Build a web app first (installable PWA later in P3). Wrap it with Capacitor if it needs to be in the app stores. | One codebase, no store review, and location access works in the browser. |
| 2 | No backend. The browser calls the OASA API directly. | The API sends `Access-Control-Allow-Origin: *`, so nothing needs to run on a server. |
| 3 | Static data (stops, routes, route shapes) comes from files built ahead of time from the official GTFS feed. | The API has no "all stops" endpoint, and the GTFS feed (~30 MB) is too large to load in a browser. |
| 4 | Live data (arrivals, bus positions, closest stops) and line timetables come from the API. | The published GTFS timetable goes stale between uploads, and there is no GTFS-Realtime feed. |
| 5 | Stack: React, TypeScript, Vite, TanStack Query, React Router, MapLibre with OpenFreeMap tiles. | Widely used, free map tiles with no API key, and MapLibre handles thousands of points. |
| 6 | The API client lives in a separate library repo, installed from GitHub pinned to a commit. | The library stays reusable and fixes can go upstream. Pinning to a commit means a later push cannot change what gets installed. |
| 7 | Add a small proxy (Cloudflare Worker) only if needed. | Triggers: OASA blocks browser calls, becomes unreliable, or we need push notifications. |
| 8 | No accounts. Favourites are stored on the device. | Keeps the app simple and private. |

## Layers

Each layer only depends on the one below it.

```
UI components            features/*/  (pages, map, lists)
        ↓
Feature hooks            useNearbyStops(), useArrivals(), ...  (TanStack Query)
        ↓
Adapters / repositories  data/oasa/adapters.ts  → domain types in domain/types.ts
        ↓
Data sources             oasa-telematics-api (live)  +  static JSON from GTFS
```

## Patterns

- **Anti-corruption layer.** `data/oasa/adapters.ts` is the only place that knows the raw OASA format
  (numbers as strings, `1900-01-01 05:10:00` times, `StopCode` vs `StopID`). The rest of the app uses
  the types in `domain/types.ts`.
- **Repository.** Feature code asks for a stop or a line without knowing whether it came from the GTFS
  files or the API.
- **Ports and adapters (light).** The OASA client takes its request function as a parameter, so tests
  can use fake data and a proxy can be swapped in later.
- **Vertical slices.** Code is grouped by feature (`features/nearby`, `features/stop`, ...).
- **Stale-while-revalidate and polling.** TanStack Query shows cached data and refreshes it in the
  background. Live arrivals refresh every 20–30 s while visible.
- **Graceful degradation.** Requests time out after 8 s and retry once. If live data is unavailable,
  the rest of the app keeps working.
- **URL as state.** What is on screen lives in the URL (`/stop/400075`, `/line/021`), so links can be
  shared and the back button works.

Patterns such as the outbox, CQRS and event sourcing are deliberately not used: the app has no
database and never writes data.

## OASA data notes

- GTFS `stop_id` is the API's `StopCode`; GTFS `stop_code` is the API's `StopID` (the number on the sign).
- About 94% of stop codes seen in the API exist in the GTFS feed; the rest need an API fallback.
- Timetable times look like `1900-01-01 05:10:00`. Trips after midnight use `1900-01-02`.
- In a timetable entry, the `*1` fields describe the outbound trip and the `*2` fields the return trip.
- The official GTFS feed is published on [data.gov.gr](https://data.gov.gr) and listed in the
  [Mobility Database](https://mobilitydatabase.org/feeds/gtfs/mdb-3220).
