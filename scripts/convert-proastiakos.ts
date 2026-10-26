// Writes scripts/proastiakos-timetable.json: every Proastiakos trip from Hellenic Train's timetable
// PDFs, listed on its "Προαστιακές και Περιφερειακές γραμμές Αθήνας" page. There is no GTFS feed or
// other open timetable for the Proastiakos (checked on data.gov.gr and nap.gov.gr, Oct 2026).
// Hellenic Train changes the timetable a few times a year, so this runs by hand and the result is
// committed; the nightly metro build (scripts/build-metro.ts) reads it and warns when the page links
// to other PDFs than the ones converted. Needs `pdftotext` (poppler-utils):
//   node scripts/convert-proastiakos.ts
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  PROASTIAKOS_PAGE,
  parseClock,
  parseTimetableText,
  timetablePdfs,
  type ProastiakosTimetable,
  type ProastiakosTrip,
} from './proastiakosData.ts'

const OUTPUT = new URL('./proastiakos-timetable.json', import.meta.url)
const STATIONS = new URL('./proastiakos-stations.json', import.meta.url)
const USER_AGENT = 'athens-bus-app Proastiakos timetable (+https://github.com/deepblue597/athens-bus-app)'
const TIMEOUT_MS = 60_000

/** Each PDF's line, from its file name (which gains suffixes such as -1 or -d-p between versions) */
const LINE_OF_PDF: [RegExp, string][] = [
  [/peiraias-athina-aerodromio/, 'A1'],
  [/ano-liosia-aerodromio/, 'A2'],
  [/athina-chalkida/, 'A3'],
  [/peiraias-kiato/, 'A4'],
]

async function main() {
  const pdfs = timetablePdfs(await fetchText(PROASTIAKOS_PAGE))
  const stations = JSON.parse(await readFile(STATIONS, 'utf8')) as Record<string, unknown>
  const dir = await mkdtemp(join(tmpdir(), 'proastiakos-'))
  const trips: ProastiakosTrip[] = []
  try {
    for (const url of pdfs) {
      const line = lineOfPdf(url)
      const file = join(dir, 'timetable.pdf')
      await writeFile(file, await fetchBytes(url))
      const text = execFileSync('pdftotext', ['-layout', '-enc', 'UTF-8', file, '-'], { encoding: 'utf8' })
      const found = parseTimetableText(text, line)
      console.log(`${line}: ${found.length} trips from ${url}`)
      trips.push(...found)
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }

  const unknown = [...new Set(trips.flatMap((t) => t.stops.map(([name]) => name)))].filter((name) => !stations[name])
  if (unknown.length > 0) {
    throw new Error(`Stations missing from scripts/proastiakos-stations.json: ${unknown.join(', ')}`)
  }
  for (const line of new Set(LINE_OF_PDF.map(([, l]) => l))) {
    if (!trips.some((t) => t.line === line)) {
      throw new Error(`No trips for ${line}: did Hellenic Train rename its PDF?`)
    }
  }
  const sorted = trips.sort(
    (a, b) => a.line.localeCompare(b.line) || parseClock(a.stops[0][1]) - parseClock(b.stops[0][1]) || a.train.localeCompare(b.train),
  )
  const timetable: ProastiakosTimetable = {
    _comment: 'Written by scripts/convert-proastiakos.ts from Hellenic Train’s timetable PDFs. Don’t edit by hand: rerun the script.',
    page: PROASTIAKOS_PAGE,
    pdfs,
    trips: sorted,
  }
  // One trip per line, so a new timetable shows up as a readable diff
  const json = JSON.stringify({ ...timetable, trips: [] }, null, 2).replace(
    '"trips": []',
    `"trips": [\n${sorted.map((t) => `    ${JSON.stringify(t)}`).join(',\n')}\n  ]`,
  )
  await writeFile(OUTPUT, json + '\n')
  console.log(`${sorted.length} trips written`)
}

function lineOfPdf(url: string): string {
  const name = decodeURIComponent(url.slice(url.lastIndexOf('/') + 1))
  const match = LINE_OF_PDF.find(([pattern]) => pattern.test(name))
  if (!match) {
    throw new Error(`A timetable PDF the converter doesn't know: ${url}. Add it to LINE_OF_PDF.`)
  }
  return match[1]
}

async function fetchText(url: string): Promise<string> {
  return (await get(url)).text()
}

async function fetchBytes(url: string): Promise<Buffer> {
  return Buffer.from(await (await get(url)).arrayBuffer())
}

async function get(url: string): Promise<Response> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) {
    throw new Error(`${url}: HTTP ${res.status}`)
  }
  return res
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
