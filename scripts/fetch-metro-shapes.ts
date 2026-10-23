// Writes scripts/metro-shapes.json: the tracks of each metro and tram line from OpenStreetMap
// (© OpenStreetMap contributors, ODbL), for drawing the lines and placing trains along them. STASY's
// feed has no shapes.
// The lines rarely change, so this runs by hand (`node scripts/fetch-metro-shapes.ts`) and the result is
// committed; the nightly build reads the file instead of depending on Overpass.
import { writeFile } from 'node:fs/promises'
import { simplify, type LngLat } from '../src/domain/polyline.ts'
import { stitchWays } from './metroData.ts'

const OVERPASS = 'https://overpass-api.de/api/interpreter'
const USER_AGENT = 'athens-bus-app metro shapes (+https://github.com/deepblue597/athens-bus-app)'
const OUTPUT = new URL('./metro-shapes.json', import.meta.url)
/** Points within this many metres of the simplified line are dropped */
const TOLERANCE_M = 4

/**
 * Route relations per line, each a track. A metro line has one: both directions run on the same
 * corridor. The tram has one per direction, as its directions part in places (T7's one-way loop
 * through Piraeus).
 */
const RELATIONS: Record<string, number[]> = {
  M1: [445858], // Πειραιάς → Κηφισιά
  M2: [7963539], // Ανθούπολη → Ελληνικό
  M3: [445945], // Δημοτικό Θέατρο → Αεροδρόμιο
  T6: [3648688, 3648687], // Σύνταγμα → Πικροδάφνη, and back
  T7: [6792078, 6792077], // Ακτή Ποσειδώνος → Βούλα, and back
}

interface OverpassRelation {
  id: number
  members: { type: string; role: string; geometry?: { lat: number; lon: number }[] }[]
}

async function main() {
  const query = `[out:json][timeout:120];relation(id:${Object.values(RELATIONS).flat().join(',')});out geom;`
  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ data: query }),
  })
  if (!res.ok) {
    throw new Error(`Overpass: HTTP ${res.status}`)
  }
  const { elements } = (await res.json()) as { elements: OverpassRelation[] }
  const shapes: Record<string, LngLat[][]> = {}
  for (const [line, ids] of Object.entries(RELATIONS)) {
    shapes[line] = ids.map((id) => {
      const relation = elements.find((e) => e.id === id)
      if (!relation) {
        throw new Error(`Relation ${id} (${line}) not returned`)
      }
      // Track ways have no role; platforms are listed too, with "platform" roles
      const ways = relation.members
        .filter((m) => m.type === 'way' && m.role === '' && m.geometry)
        .map((m) => m.geometry!.map((p): LngLat => [p.lon, p.lat]))
      const path = simplify(stitchWays(ways), TOLERANCE_M).map(([lng, lat]): LngLat => [round(lng), round(lat)])
      console.log(`${line} (${id}): ${ways.length} ways, ${path.length} points`)
      return path
    })
  }
  await writeFile(OUTPUT, JSON.stringify(shapes) + '\n')
}

/** 5 decimals is about 1 m */
const round = (value: number) => Math.round(value * 1e5) / 1e5

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
