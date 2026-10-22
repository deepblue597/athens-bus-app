# Architecture

This document records the main decisions for the app and the reasons behind them.

## Decisions

| # | Decision | Reason |
|---|---|---|
| 1 | Build an installable web app (PWA). Wrap it with Capacitor only if it needs to be in the app stores. | One codebase, no store review, and location access works in the browser. Installed from the browser, it gets its own icon, opens full screen and works offline. |
| 2 | No backend of our own, but API calls go through a thin same-origin proxy (`/oasa/*` → `telematics.oasa.gr`): Vite's proxy in development, a Cloudflare Worker (`worker/`) in production. | OASA sends `Access-Control-Allow-Origin: *` only on some endpoints (e.g. `webGetLines`, `webGetStops`) and not on `getClosestStops`, `getStopArrivals` or `webRoutesForStop`, so browsers block direct calls. |
| 3 | The list of all stops is a file (`public/data/stops.json`) rebuilt nightly by crawling the live API (lines → routes → stops). | The API has no "all stops" endpoint. The official GTFS feed was considered, but it is published irregularly (stale since 6 Oct 2026) and misses temporary routes, while the API is what OASA's own app uses. |
| 4 | Live data (arrivals, bus positions every 15 s, closest stops) and line timetables come from the API. | The published GTFS timetable goes stale between uploads, and there is no GTFS-Realtime feed. |
| 5 | Stack: React, TypeScript, Vite, TanStack Query, React Router, MapLibre with OpenFreeMap tiles. | Widely used, free map tiles with no API key, and MapLibre handles thousands of points. |
| 6 | The API client lives in a separate library repo, installed from GitHub pinned to a commit. | The library stays reusable and fixes can go upstream. Pinning to a commit means a later push cannot change what gets installed. |
| 7 | Keep the proxy thin: forward only the GET calls the app makes (an allowlist), with short edge caching per call (5 s for live data, up to 1 h for routes). | It exists because of CORS (decision 2). The allowlist stops it being an open proxy, and the cache means many people watching one stop cost OASA one request every few seconds. |
| 8 | No accounts. Favourites are stored on the device. | Keeps the app simple and private. |
| 9 | Offline: the service worker caches the app, map tiles and the stops file; TanStack Query saves lines, routes and timetables in localStorage (refetched after 12 h and 1 h); live data (arrivals, nearby stops) is never saved. | The app opens and shows what you looked at before without a connection, while anything shown as live really is live. |
| 10 | Android app with Capacitor: the same build (`--mode android`, no service worker) in a native WebView; OASA calls go through Capacitor's native HTTP. | One codebase. Native HTTP has no CORS limits and runs from the phone, so the app doesn't depend on the proxy or on Cloudflare reaching OASA. |
| 11 | The News tab reads OASA's announcements from www.oasa.gr's WordPress REST API (category 82), not by scraping the page. On the web it goes through a second allowlisted Worker route (`/oasa-web/*`) that rebuilds the request and keeps answers in Cloudflare's Cache API (5 min for the first page, 1 h otherwise, a day-old copy when oasa.gr is down). The Android app calls oasa.gr directly, as in decision 10. Bodies are shown in the app after DOMPurify (`shared/sanitizeHtml.ts`) with a link to the original. | The API has full, structured posts and is up to date, while the HTML page is served from a cache hours old. Parsing stays in the app (one code path for web and Android); the Worker only protects oasa.gr, whose API isn't cached and takes 1–2 s. Every announcement credits and links to oasa.gr. |
| 12 | Main tabs: a bottom bar on phones (under 768px), tabs in the header on wider screens. It is one `<nav>` that CSS grid moves, with the tab list and "which tab is this page in" in `app/nav.ts`. The bar stays on detail pages (a route page belongs to Lines when opened from a timetable, otherwise Nearby) and hides while typing. Android's back button closes an open sheet, then goes back within a tab, then to Nearby from another tab, then sends the app to the background. | The bottom of the screen is in thumb reach and is where Android users expect tabs, and a fourth tab (Metro) doesn't fit next to the title on a 360px phone. On wide screens there is room in the header and the bottom bar would only take height. |

## Keeping data current

- **Routes, stops of a route and timetables** are fetched from the API when needed. Saved copies are
  shown at once and refetched in the background once they are older than 12 h (routes and stops) or
  1 h (timetables), so detours and timetable changes appear within hours.
- **The stops file** is rebuilt by `scripts/build-stops.ts` (~1,200 requests, about 2 minutes), which
  writes only when something changed. `.github/workflows/update-stops.yml` was meant to run it nightly,
  but **OASA drops connections from outside Greece** (GitHub's runners time out; see the data notes),
  so the workflow is disabled and the script is run from a machine in Greece:
  `npm run build:stops`, then commit and push. The script refuses to replace the file when it finds under 90% of the
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
- `telematics.oasa.gr` only accepts connections from Greece (checked 20 Oct 2026): from GitHub's
  runners (US) the TCP connection times out on ports 80 and 443, while `www.oasa.gr` answers. A
  Cloudflare Worker running in Athens (`ATH`) gets through over HTTPS, so the production proxy works
  for users in Greece. Plain HTTP doesn't answer from anywhere.
- It throttles with HTTP 403 above about 10 requests per second.
- `getBusLocation` reports `CS_DATE` in Athens local time (`Oct 20 2026 08:56:56:000PM`), and its
  `VEH_NO` is the same code as `veh_code` in `getStopArrivals`, so an arrival can be matched to a bus.

### Announcements (www.oasa.gr)

- WordPress REST API: `/wp-json/wp/v2/posts?categories=82` is the "Ανακοινώσεις" list (~3 posts a
  day). The English category (95) has a few posts weeks behind, so the app shows the Greek ones.
- `date_gmt` and `modified_gmt` are UTC without a `Z`; `date` is Athens time. Paging uses
  `before=<date_gmt>Z`: without the `Z` WordPress reads it as Athens time and skips posts. `before`
  is exclusive, so posts published in the same second can repeat across pages (the app dedupes).
- `search=` is fuzzy (`search=060` also finds Χ20), so it can't filter by line.
- The API sends `Cache-Control: max-age=0` and a `Set-Cookie`, and takes 1–2 s; the HTML page
  `/ανακοινώσεις/` is served from Varnish and was ~6 h behind the API when checked (21 Oct 2026).
- Bodies use only `p`, `strong`/`b`, `u`, `em`, `sup`, `br`, lists, tables (lists of closed stops,
  with stop codes) and the odd link, sometimes wrapped in `<article>`. 95 of 100 start with
  "Με στόχο την ενημέρωση ... ο ΟΑΣΑ ανακοινώνει", which the list summary leaves out.
- `npm run test:live` checks the category, paging and single posts against the live site.
- OASA's terms say the site's content is for personal use and reprinting needs written permission;
  the app credits and links every announcement, but permission hasn't been asked for (Oct 2026).

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
