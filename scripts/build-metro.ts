// Builds public/data/metro.json: metro lines M1–M3, tram lines T6 and T7, their stations and every trip
// in STASY's GTFS feed (from data.gov.gr), for the Rail tab's timetable-based train positions and departures.
// Runs nightly in .github/workflows/update-metro.yml; locally: `npm run build:metro`.
// METRO_FEED=path/to/feed.zip uses a downloaded feed instead.
// Uses only Node built-ins, so it runs without `npm install`.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { inflateRawSync } from 'node:zlib'
import { METRO_FILE_VERSION, type MetroFile } from '../src/domain/metroFile.ts'
import type { LngLat } from '../src/domain/polyline.ts'
import { toMetroFile, type GtfsFiles, type StationTable } from './metroData.ts'

/** data.gov.gr's dataset "Δρομολόγια Σταθερών Συγκοινωνιών (ΜΕΤΡΟ, ΗΣΑΠ, ΤΡΑΜ)" and its GTFS resource */
const DATASET_API = 'https://data.gov.gr/api/3/action/package_show?id=4e897a75-975a-4ce7-af65-f32ea01f93b9'
const GTFS_RESOURCE = '5e3858ee-d9ba-48c2-9015-744ea160976d'
const OUTPUT = new URL('../public/data/metro.json', import.meta.url)
const SHAPES = new URL('./metro-shapes.json', import.meta.url)
const STATIONS = new URL('./metro-stations.json', import.meta.url)
const TRAM_STOPS = new URL('./tram-stops.json', import.meta.url)
const USER_AGENT = 'athens-bus-app metro builder (+https://github.com/deepblue597/athens-bus-app)'
const TIMEOUT_MS = 120_000

async function main() {
  const zip = process.env.METRO_FEED ? await readFile(process.env.METRO_FEED) : await download()
  const files = unzip(zip)
  const need = ['routes.txt', 'trips.txt', 'stop_times.txt', 'stops.txt', 'calendar_dates.txt'] as const
  const gtfs = Object.fromEntries(
    need.map((name) => {
      const file = files.get(name)
      if (!file) {
        throw new Error(`The feed has no ${name}`)
      }
      return [name, file.toString('utf8')]
    }),
  ) as unknown as GtfsFiles

  const shapes = JSON.parse(await readFile(SHAPES, 'utf8')) as Record<string, LngLat[][]>
  const file = toMetroFile(gtfs, shapes, { metro: await readTable(STATIONS), tram: await readTable(TRAM_STOPS) })

  // STASY sometimes uploads late: never replace a timetable with one that ends earlier
  const previous = await readPrevious()
  if (previous && file.lastDate < previous.lastDate) {
    console.log(`The feed ends ${file.lastDate}, before the current file (${previous.lastDate}): keeping the current file`)
    return
  }

  // No timestamp in the file, so it only changes (and gets committed) when the data does
  const json = JSON.stringify(file)
  const changed = json !== (previous ? JSON.stringify(previous) : '')
  if (changed) {
    await mkdir(new URL('.', OUTPUT), { recursive: true })
    await writeFile(OUTPUT, json + '\n')
  }
  console.log(
    `${file.firstDate} – ${file.lastDate}: ${file.stations.length} stations, ${file.patterns.length} patterns, ` +
      `${file.plans.length} day plans, ${Math.round(json.length / 1024)} KB: ${changed ? 'updated' : 'unchanged'}`,
  )
  const today = new Date().toISOString().slice(0, 10)
  if (file.lastDate < today) {
    // The app falls back to the last published week, with a notice; fail so the job shows up red
    throw new Error(`STASY's timetable ended on ${file.lastDate} and no newer one is published`)
  }
}

/** The resource's URL comes from the dataset's API: STASY has renamed the file before (.zip → .rar) */
async function download(): Promise<Buffer> {
  const res = await fetch(DATASET_API, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) {
    throw new Error(`data.gov.gr API: HTTP ${res.status}`)
  }
  const { result } = (await res.json()) as { result: { resources: { id: string; url: string }[] } }
  const resource = result.resources.find((r) => r.id === GTFS_RESOURCE)
  if (!resource) {
    throw new Error('The GTFS resource is no longer in the dataset')
  }
  const feed = await fetch(resource.url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!feed.ok) {
    throw new Error(`${resource.url}: HTTP ${feed.status}`)
  }
  return Buffer.from(await feed.arrayBuffer())
}

/** Reads a zip archive's files (stored or deflated), from its central directory */
function unzip(zip: Buffer): Map<string, Buffer> {
  // End of central directory record: the last "PK\x05\x06" (a comment may follow it)
  let end = -1
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65_557); i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      end = i
      break
    }
  }
  if (end < 0) {
    throw new Error('The feed is not a zip archive')
  }
  const count = zip.readUInt16LE(end + 10)
  let offset = zip.readUInt32LE(end + 16)
  const files = new Map<string, Buffer>()
  for (let n = 0; n < count; n++) {
    if (zip.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error('Corrupt zip central directory')
    }
    const method = zip.readUInt16LE(offset + 10)
    const compressedSize = zip.readUInt32LE(offset + 20)
    const nameLength = zip.readUInt16LE(offset + 28)
    const extraLength = zip.readUInt16LE(offset + 30)
    const commentLength = zip.readUInt16LE(offset + 32)
    const localOffset = zip.readUInt32LE(offset + 42)
    const name = zip.toString('utf8', offset + 46, offset + 46 + nameLength)
    // The local header repeats the name and has its own extra field
    const dataStart = localOffset + 30 + zip.readUInt16LE(localOffset + 26) + zip.readUInt16LE(localOffset + 28)
    const data = zip.subarray(dataStart, dataStart + compressedSize)
    if (method === 0) files.set(baseName(name), data)
    else if (method === 8) files.set(baseName(name), inflateRawSync(data))
    else throw new Error(`${name}: unsupported compression method ${method}`)
    offset += 46 + nameLength + extraLength + commentLength
  }
  return files
}

/** Files may sit in a folder inside the archive */
const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1)

async function readTable(url: URL): Promise<StationTable> {
  const table = JSON.parse(await readFile(url, 'utf8')) as StationTable & { _comment?: unknown }
  delete table._comment
  return table
}

/** The current file, unless it's in an older format (then the new one replaces it whatever its dates) */
async function readPrevious(): Promise<MetroFile | null> {
  try {
    const file = JSON.parse(await readFile(OUTPUT, 'utf8')) as MetroFile
    return file?.version === METRO_FILE_VERSION ? file : null
  } catch {
    return null
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
