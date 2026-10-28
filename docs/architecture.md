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
| 12 | Main tabs: a bottom bar on phones (under 768px), tabs in the header on wider screens. It is one `<nav>` that CSS grid moves, with the tab list and "which tab is this page in" in `app/nav.ts`. The bar stays on detail pages (a route page belongs to Lines when opened from a timetable, otherwise Nearby) and hides while typing. Android's back button closes an open sheet, then goes back within a tab, then to Nearby from another tab, then sends the app to the background. | The bottom of the screen is in thumb reach and is where Android users expect tabs, and a fourth tab (Rail) doesn't fit next to the title on a 360px phone. On wide screens there is room in the header and the bottom bar would only take height. |
| 13 | Metro and tram: no live positions exist (STASY publishes none, and Citymapper's tram times are scheduled too), so the Rail tab places trains and trams by STASY's GTFS timetable. `scripts/build-metro.ts` turns the feed into `public/data/metro.json` (~67 KB gzipped with the Proastiakos: each day is a list of (stop pattern, start time) pairs, identical days shared), with line tracks from OpenStreetMap committed in `scripts/metro-shapes.json`: one per metro line, one per direction for a tram line (T7 loops one way through Piraeus), each trip pattern placed on the track it follows. The Android app downloads the file from the site and falls back to its built-in copy, so it gets new timetables without a new release; the file has a `version`, and an app ignores a file in a format it can't read. Positions and departures are worked out on the device (`domain/trainPositions.ts`) every 2 s on the map and 15 s on station pages. Estimates are always labelled as such: a ring marker unlike the bus arrows, “estimated from the timetable” on the map, “~4 min” and “scheduled, not live” on station pages. | No backend is needed and it works offline, the same on the web and in the Android app. This extends decision 9: derived data from a static timetable may be shown offline, as long as it never looks live. |
| 14 | The Proastiakos (A1–A4) is a third mode in the same rail file, `"suburban"`. Its timetable comes from Hellenic Train's PDFs: `scripts/convert-proastiakos.ts` (run by hand, needs `pdftotext`) parses them into `scripts/proastiakos-timetable.json`, which is committed, and the nightly build adds its weekday, weekend and daily trips to every date STASY's timetable covers, with the weekend timetable on Greek public holidays (`domain/holidays.ts`). Station pages also show the station's live board from OSE (`ose.mpass.ltd`, the screens Hellenic Train's live page links to): train, destination, platform, delay and cancellation, every 30 s, with trains arriving listed apart and long-distance trains (an end off the Proastiakos, matched by name) tagged, through `/ose/screens/{board}` on the web (`worker/oseProxy.ts`, 30 s edge cache) and directly in the Android app. The live board is never saved. | There is no GTFS or other open timetable for the Proastiakos (data.gov.gr and nap.gov.gr only have a 2020–21 spreadsheet). One file keeps the map, departures and offline use the same for every mode. OSE allows any origin and needs no key, so the Worker is there only so many viewers cost OSE one request per 30 s. Live departures are labelled as OSE's; the timetable below them stays labelled "scheduled, not live". |
| 15 | Rail announcements come from the News tab's list: `domain/railNews.ts` picks OASA posts about rail service (station closed or reopened, "οι συρμοί", "until the metro closes", tram diversions), not bus detours that only name a station, and matches the stations named in the title word by word (declined and abbreviated names allowed, the whole name required). The Rail tab shows the last week's; a station page those naming it. OSE's own notices for a Proastiakos station come with its live board. | STASY's site locks its WordPress API ("REST API restricted to authenticated users") and has no feed, and Hellenic Train's feed is gone (410), so OASA's posts are the one open source; OASA does announce metro closures and replacement buses. Keyword rules are checked against 100 real posts. |
| 16 | The Nearby tab shows rail stations: rings in their line's colour on the map (from zoom 11, names from 14) and the three closest within 1.2 km under the bus stops. | Changing between bus and rail is the common trip; a station is worth a longer walk than a bus stop. |
| 17 | "Report a problem", linked from the header on every page, opens a GitHub issue through the Worker (`POST /api/feedback`, `worker/feedback.ts`), which holds a token limited to this repo's issues. The report carries the page it was sent from, the app version and build, and the system and browser without the phone model, all listed on the form before sending. The message is put in a code block, so it can't mention people or load images; the Worker accepts the site's own origin or none (the Android app's native HTTP), 3 reports a minute per address, and drops reports with a hidden field filled in. | Problems are found by people on the street, not by us, and most need the page and time to reproduce. Issues keep reports where the work is tracked and need no backend or inbox. The app stays free of accounts and tracking: nothing is sent unless someone sends a report, and the form says reports are public. If spam gets through, Cloudflare Turnstile is the next step. |

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
- **The metro and tram timetable** is rebuilt nightly by `.github/workflows/update-metro.yml` (`scripts/build-metro.ts`,
  a few seconds). STASY publishes a timetable a few times a year covering about six weeks, sometimes
  after the previous one ends. The script never replaces a timetable with one that ends earlier, and
  fails the job while the published one has ended. The app then uses the latest published day of the
  same weekday and shows a notice (holidays are missed then). The Android app downloads the site's
  copy, so it doesn't need a release for a new timetable. Changing the file's format means bumping
  `METRO_FILE_VERSION` and the service worker's `metro-file-v…` cache name; apps on the old format
  then keep using their built-in copy until they're updated.
- **The Proastiakos timetable** changes a few times a year, when Hellenic Train uploads new PDFs to
  its [lines page](https://www.hellenictrain.gr/proastiakes-grammes-athinas/). The nightly build reads
  the committed `scripts/proastiakos-timetable.json`, and fails (after writing the file) when the page
  links other PDFs than the ones it was converted from: then run `npm run convert:proastiakos`, check
  the diff and commit. The converter fails on anything it can't read (a station missing from
  `scripts/proastiakos-stations.json`, a footnote it doesn't know, a row with the wrong number of times)
  rather than guess.

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
database and never writes data (problem reports go straight to GitHub as issues).

## STASY metro and tram data notes

- Source: the "ΣΤΑ.ΣΥ. GTFS" resource of data.gov.gr's dataset 4e897a75-975a-4ce7-af65-f32ea01f93b9. The file was
  renamed from `stasy_gtfs.zip` to `stasy_gtfs.rar` in October 2026 (it is still a zip), so the build
  looks its URL up through the CKAN API (`package_show`). The September feed covered 16 Sep – 31 Oct 2026.
- It has M1–M3 and tram lines T6/T7 (route_type 0), but no Proastiakos, no `shapes.txt`, no
  `calendar.txt` (one service per date in `calendar_dates.txt`) and no `frequencies.txt`: every trip has
  exact times with dwell at each station.
- Stops are per platform without parent stations, and names are uppercase Greek abbreviations
  (`Δ. ΠΛΑΚΕΝΤΙΑΣ`). `scripts/metro-stations.json` groups them into stations by name, with proper and
  English names; a new name fails the build until it's added there. `ΣΥΝΔΕΣΗ ΠΡΟΑΣΤΙΑΚΟΥ` is the M3's
  junction with the suburban line, not a station, and is left out.
- Tram stop names are in mixed case with typos (`Μουσσών`, `Γήπεδο ΚαραΙσκάκη`) and share some names
  with metro stations (Σύνταγμα), so they have their own table, `scripts/tram-stops.json`, and ids
  starting `tram-`. Its entries can correct a position: the feed rounds Μαρίνα Αλίμου to 37.91, 23.71.
- T7 runs a one-way loop in Piraeus: towards Voula via Αγία Τριάδα and Ανδρούτσου, back via Γήπεδο
  Καραϊσκάκη and Δημαρχείο. Some trips run ΣΕΦ – Βούλα. The station pages say when a stop is served
  one way only.
- A tram stop and a metro station within 400 m are shown as a change on each other's page.
- `trip_headsign` is unreliable (often the origin), so a train's destination is its trip's last stop.
- Saturday nights run through the night on M2 and M3 (times past 29:00).

## Proastiakos data notes

Research for P6d (October 2026).

- **No open timetable.** data.gov.gr and nap.gov.gr have only "Information about rail transport in
  Greece" (TRAINOSE, XLSX for 2020 and 2021). STASY's GTFS has the M3's junction with the
  Proastiakos but no Proastiakos trains.
- **Timetable PDFs.** Hellenic Train's page links one PDF per line (two for A2: Monday–Friday, and
  weekends and holidays), made in Word, so `pdftotext -layout` gives clean tables. "..." or "…" means
  the train doesn't run to that station, "|" that it passes without stopping; some times are written
  `4.41`; long names wrap with their times on a line between the halves; a note above a table lists
  trains that don't run at weekends ("Τα Δρομολόγια 3201 & 3204 ΔΕΝ κυκλοφορούν Σαββατοκύριακα") and
  those trains are starred. The PDFs give one time per station. Trains leaving after midnight
  (Χαλκίδα 0:00) belong to the previous service day.
- Checked against the live boards (27 Oct 2026, 45 stations): 202 of 225 entries matched to the
  minute, 10 were 1–4 minutes off (A3 around Οινόη, A4 around Μέγαρα), and 13 weren't Proastiakos
  timetable trains: the 300 to Αίγιο, the M3's airport trains (6000s), and runs from Ρέντης depot that
  the PDFs start at Ταύρος.
- **Shapes and stations** come from OSM's route relations (A1 8467445, A2 8467443, A3 8467442, A4
  8467515, one direction each, simplified at 10 m) and their stop positions. ΣΚΑ is a junction whose
  A2 platforms are ~300 m from the A3's, so Proastiakos stations may sit up to 250 m from a track.
- **Live boards.** `GET https://ose.mpass.ltd/api/v1/screens/{board}/data/multilingual`, no key,
  `Access-Control-Allow-Origin: *`, `Cache-Control: no-store`. It is the backend of OSE's station
  screens (`ose.mpass.ltd/#/routesInfos/{board}`, linked from Hellenic Train's live page; the older
  `delays.osenet.gr/station/{board}/` shows the same and needs a session cookie, and its certificate
  chain is incomplete). Board numbers are in `scripts/proastiakos-stations.json` (Αθήνα 1, Πειραιάς 2,
  Αεροδρόμιο 28). Each board lists the next ~5 trains of any kind, each twice (`routesEl`,
  `routesEn`): `TRENO` (train number, trailing space), `FROMTO`, `DR_PLATFORM` (`-` when not
  announced), `DR_TAFIX` arrival and `DR_TANA` departure as `"  4:33"` (arrival null where a train
  starts, departure null where it ends), `PREVIOUSDELAY9` minutes late (what the screens show), and
  `DR_FORECASTED_DATE`, UTC within minutes of the time, the only date given. `announcements` are the
  messages the screens scroll. OSE's own screens refresh every 60 s.
- **Remarks and cancellations.** There is no status field: the screens append remarks to `FROMTO` in
  capitals and parentheses, e.g. `Αθήνα - Θεσσαλονίκη Επιβατικός (ΚΑΤΑΡΓΗΣΗ ΔΡΟΜΟΛΟΓΙΟΥ)` /
  `ATHENS - THESSALONIKI GARE CENTRALE (CANCELLED ROUTE)` (Athens, 27 Oct 2026, fixture
  `board-1-athina.json`). The app reads `ΚΑΤΑΡΓΗΣΗ ΔΡΟΜΟΛΟΓΙΟΥ` as cancelled and shows any other
  capitalised remark as it is; a parenthesis in mixed case stays part of the name. A cancelled train
  keeps a delay of 0, and OSE may drop it from the board before its time.
- **Long-distance trains** (Athens – Thessaloniki, train numbers like 51 and 52) appear on the
  boards of the stations they call at. Their names differ a little from the Proastiakos's (`Ρέντης`
  for Ρέντη, `Αθήνα` for Αθήνα (Σταθμός Λαρίσης)), so names match when one starts with the other,
  ignoring accents and case.
- The boards are an undocumented service run for OSE: the app identifies itself, caches, and links
  Hellenic Train's live page. If OSE asks, `/ose/*` can be switched off in the Worker.

## CityBus notes (Heraklion, P7b)

Research for P7b (October 2026), before any code. Nothing here is built yet.

- Heraklion's urban buses (Αστικό ΚΤΕΛ Ηρακλείου, info@astiko-irakleiou.gr) run on CityBus by
  e-analysis (https://e-analysis.eu), which serves ~24 Greek cities from one API,
  `https://rest.citybus.gr/api/v1/{lang}/{agency}/…`. Heraklion is agency `110`. The open-source
  app [astiko](https://github.com/uw0s/astiko) documents the endpoints: `stops`, `lines`, `routes`,
  `routes/{code}/sequence`, `stops/live/{stop}`, `trips/stop/{stop}/day/{0-6}`, `{agency}/lines/{code}/points`.
- Every request needs `Authorization: Bearer <JWT>`. There is no key or sign-up: the token is in
  the city's public page (`irakleio.citybus.gr`, `const token = '…'`), lasts ~48 h and isn't tied to
  a city. Without it the API answers 401. We have asked e-analysis for permission; until they answer,
  using the page's token is a grey area, so P7b ships as a beta with an off switch.
- CORS allows only CityBus's own sites, so the website can't call it: all calls go through the
  Worker, which keeps the token, caches (stops, lines, routes 24 h; live arrivals 15 s per stop),
  sends an identifying User-Agent and can switch Heraklion off. The Android app uses the Worker
  too, so no release is needed to fix or stop it. Whether CityBus refuses connections from outside
  Greece (as OASA does) is untested.
- Tests on 23 Oct 2026 (Friday ~13:40): 533 stops (with coordinates and lines, no nearby endpoint),
  26 lines, 98 routes, responses in ≤0.25 s. `stops/live` returns 404 when no bus is coming. At the
  15 busiest stops, 23 of 51 buses had GPS: those already on their trip (median 4 min away). The
  other 28, with `"0"`/`"0"` coordinates, were mostly trips not yet started (median 21.5 min), so
  timetable estimates: arrivals should say live or scheduled. There is no per-line vehicle
  endpoint, so live buses appear on stop pages only.
- A line's `points` is ~900 KB (every point with an id and 15-digit coordinates): simplify and
  cache it in the Worker.
- Heraklion has an official app (Android `gr.citybus.urbantransit.irakleio`, also on iOS) by the
  same company, rated 2.6 from 62 ratings and last updated 30 Nov 2023. It sells tickets, which
  we would leave to it.

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
