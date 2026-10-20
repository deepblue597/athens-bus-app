# Architecture

This document records the main decisions for the app and the reasons behind them.

## Decisions

| # | Decision | Reason |
|---|---|---|
| 1 | Build an installable web app (PWA). Wrap it with Capacitor only if it needs to be in the app stores. | One codebase, no store review, and location access works in the browser. Installed from the browser, it gets its own icon, opens full screen and works offline. |
| 2 | No backend of our own, but API calls go through a thin same-origin proxy (`/oasa/*` → `telematics.oasa.gr`): Vite's proxy in development, a Cloudflare Pages Function in production. | OASA sends `Access-Control-Allow-Origin: *` only on some endpoints (e.g. `webGetLines`, `webGetStops`) and not on `getClosestStops`, `getStopArrivals` or `webRoutesForStop`, so browsers block direct calls. |
| 3 | The list of all stops is a file (`public/data/stops.json`) rebuilt nightly by crawling the live API (lines → routes → stops). | The API has no "all stops" endpoint. The official GTFS feed was considered, but it is published irregularly (stale since 6 Oct 2026) and misses temporary routes, while the API is what OASA's own app uses. |
| 4 | Live data (arrivals, bus positions, closest stops) and line timetables come from the API. | The published GTFS timetable goes stale between uploads, and there is no GTFS-Realtime feed. |
| 5 | Stack: React, TypeScript, Vite, TanStack Query, React Router, MapLibre with OpenFreeMap tiles. | Widely used, free map tiles with no API key, and MapLibre handles thousands of points. |
| 6 | The API client lives in a separate library repo, installed from GitHub pinned to a commit. | The library stays reusable and fixes can go upstream. Pinning to a commit means a later push cannot change what gets installed. |
| 7 | Keep the proxy thin: forward GET requests to `/api/` only. Add caching or combined calls to it later if needed. | It already exists because of CORS (decision 2), so it is the natural place for edge caching if OASA becomes slow or unreliable. |
| 8 | No accounts. Favourites are stored on the device. | Keeps the app simple and private. |
| 9 | Offline: the service worker caches the app, map tiles and the stops file; TanStack Query saves lines, routes and timetables in localStorage (refetched after 12 h and 1 h); live data (arrivals, nearby stops) is never saved. | The app opens and shows what you looked at before without a connection, while anything shown as live really is live. |

## Keeping data current

- **Routes, stops of a route and timetables** are fetched from the API when needed. Saved copies are
  shown at once and refetched in the background once they are older than 12 h (routes and stops) or
  1 h (timetables), so detours and timetable changes appear within hours.
- **The stops file** is rebuilt every night by `.github/workflows/update-stops.yml`, which runs
  `scripts/build-stops.ts` (~1,200 requests, about a minute) and commits only when something changed;
  the push redeploys the site. The script refuses to replace the file when it finds under 90% of the
  previous number of stops, so a bad night at OASA can't empty the map. Run it locally with
  `npm run build:stops`.
- The service worker serves the saved stops file first and fetches the new one in the background.

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
- CORS headers are only sent on `webGetLines`, `webGetLinesWithMLInfo`, `webGetRoutes` and `webGetStops`,
  so all calls go through the `/oasa` proxy.
- Every response is HTTP 200. Errors arrive as `{"error": "..."}`, "nothing found" is usually `null`
  but `""` for `getBusLocation`. Run list responses through `asList()` in `data/oasa/adapters.ts`.
- `getClosestStops` always returns exactly 20 stops, ranked by flat lat/lng degrees rather than real
  distance, so in dense areas it can skip closer stops. `toNearbyStops()` keeps only the radius where
  that cannot happen.
- `getStopArrivals` sometimes lists every bus twice; `webRoutesForStop` repeats routes once per master
  line and includes hidden detour/seasonal routes. The adapters remove both.
- Some stops returned by `getClosestStops` are not served by any line (no routes, no arrivals).
- Circular routes list their first stop again at the end, so a stop code is not unique within a route.
- The library does not URL-encode parameters, so the app only passes numeric codes (`isOasaCode`).
- Typical latency is 0.1–0.3 s; the client times out after 5 s and retries once.

### Timetables

- Each timetable row is one bus doing up to two legs (`*1` from the first terminal, `*2` back from the
  other). A row is in `go` when its leg 1 runs on this line and in `come` when its leg 2 does, so
  departures from the first terminal are `go[].sde_start1` and from the other terminal
  `come[].sde_start2`. The other leg of a row can belong to another line (buses alternate between
  217 and 229), so it must not be read. Checked against 47 lines.
- `go` corresponds to the RouteType `1` route and `come` to RouteType `2`, except on single-route
  lines (circular lines, part-route variants); `timetableSides()` pairs them.
- `getDailySchedule` is today's actual plan and is the "Today" tab; it can be empty for lines that
  only run on some days (e.g. 703 on Saturday nights). `getSchedLines` ignores its first parameter.
- After-midnight trips are dated `1900-01-02`; some lines run past 05:00, so early in the morning
  the previous day's late trips can still be the next departure.
- `LineID` (the number on the bus) is not unique: part-route variants share it (`mld_master` = `0`),
  so URLs use `LineCode`.
- About 94% of stop codes seen in the API exist in the GTFS feed; the rest need an API fallback.
- Timetable times look like `1900-01-01 05:10:00`. Trips after midnight use `1900-01-02`.
- In a timetable entry, the `*1` fields describe the outbound trip and the `*2` fields the return trip.
- The official GTFS feed is published on [data.gov.gr](https://data.gov.gr) and listed in the
  [Mobility Database](https://mobilitydatabase.org/feeds/gtfs/mdb-3220).
