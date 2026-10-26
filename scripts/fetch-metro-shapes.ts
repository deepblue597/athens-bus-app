// Writes scripts/metro-shapes.json: the tracks of each metro, tram and Proastiakos line from OpenStreetMap
// (© OpenStreetMap contributors, ODbL), for drawing the lines and placing trains along them. Neither
// STASY's feed nor Hellenic Train's timetables have shapes.
// The lines rarely change, so this runs by hand and the result is committed; the nightly build reads
// the file instead of depending on Overpass.
//   node scripts/fetch-metro-shapes.ts           every line
//   node scripts/fetch-metro-shapes.ts A1 A4     only these lines; the others stay as they are
// OSM_FILE=path/to/overpass.json reads a saved Overpass answer instead of asking Overpass.
import { readFile, writeFile } from 'node:fs/promises'
import { simplify, type LngLat } from '../src/domain/polyline.ts'
import { stitchWays } from './metroData.ts'

const OVERPASS = 'https://overpass-api.de/api/interpreter'
const USER_AGENT = 'athens-bus-app metro shapes (+https://github.com/deepblue597/athens-bus-app)'
const OUTPUT = new URL('./metro-shapes.json', import.meta.url)
/** Points within this many metres of the simplified line are dropped */
const TOLERANCE_M = 4
/** The Proastiakos runs 120 km out to Kiato and Chalkida, mostly on long curves: 10 m keeps the file small */
const SUBURBAN_TOLERANCE_M = 10

/**
 * Route relations per line, each a track. A metro line has one: both directions run on the same
 * corridor, as do the Proastiakos's. The tram has one per direction, as its directions part in
 * places (T7's one-way loop through Piraeus).
 */
const RELATIONS: Record<string, number[]> = {
  M1: [445858], // Πειραιάς → Κηφισιά
  M2: [7963539], // Ανθούπολη → Ελληνικό
  M3: [445945], // Δημοτικό Θέατρο → Αεροδρόμιο
  T6: [3648688, 3648687], // Σύνταγμα → Πικροδάφνη, and back
  T7: [6792078, 6792077], // Ακτή Ποσειδώνος → Βούλα, and back
  A1: [8467445], // Πειραιάς → Αεροδρόμιο
  A2: [8467443], // Άνω Λιόσια → Αεροδρόμιο
  A3: [8467442], // Αθήνα → Χαλκίδα
  A4: [8467515], // Πειραιάς → Κιάτο
}

interface OverpassRelation {
  id: number
  members: { type: string; role: string; geometry?: { lat: number; lon: number }[] }[]
}

async function main() {
  const wanted = process.argv.slice(2)
  for (const line of wanted) {
    if (!RELATIONS[line]) {
      throw new Error(`Unknown line ${line}: one of ${Object.keys(RELATIONS).join(', ')}`)
    }
  }
  const lines = wanted.length > 0 ? wanted : Object.keys(RELATIONS)
  const elements = await relations(lines.flatMap((line) => RELATIONS[line]))
  const shapes = wanted.length > 0 ? await readCurrent() : {}
  for (const line of lines) {
    const tolerance = line.startsWith('A') ? SUBURBAN_TOLERANCE_M : TOLERANCE_M
    shapes[line] = RELATIONS[line].map((id) => {
      const relation = elements.find((e) => e.id === id)
      if (!relation) {
        throw new Error(`Relation ${id} (${line}) not returned`)
      }
      // Track ways have no role; platforms are listed too, with "platform" roles
      const ways = relation.members
        .filter((m) => m.type === 'way' && m.role === '' && m.geometry)
        .map((m) => m.geometry!.map((p): LngLat => [p.lon, p.lat]))
      const path = simplify(stitchWays(ways), tolerance).map(([lng, lat]): LngLat => [round(lng), round(lat)])
      console.log(`${line} (${id}): ${ways.length} ways, ${path.length} points`)
      return path
    })
  }
  // Same line order as RELATIONS whatever was updated, so a partial update doesn't reorder the file
  const ordered = Object.fromEntries(Object.keys(RELATIONS).filter((l) => shapes[l]).map((l) => [l, shapes[l]]))
  await writeFile(OUTPUT, JSON.stringify(ordered) + '\n')
}

async function relations(ids: number[]): Promise<OverpassRelation[]> {
  if (process.env.OSM_FILE) {
    return ((JSON.parse(await readFile(process.env.OSM_FILE, 'utf8')) as { elements: OverpassRelation[] }).elements)
  }
  const query = `[out:json][timeout:120];relation(id:${ids.join(',')});out geom;`
  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ data: query }),
  })
  if (!res.ok) {
    throw new Error(`Overpass: HTTP ${res.status}`)
  }
  return ((await res.json()) as { elements: OverpassRelation[] }).elements
}

async function readCurrent(): Promise<Record<string, LngLat[][]>> {
  try {
    return JSON.parse(await readFile(OUTPUT, 'utf8')) as Record<string, LngLat[][]>
  } catch {
    return {}
  }
}

/** 5 decimals is about 1 m */
const round = (value: number) => Math.round(value * 1e5) / 1e5

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
