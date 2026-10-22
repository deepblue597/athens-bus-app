import type { MetroLine, MetroNetwork, MetroStation } from '../domain/metro'
import type { MetroFile } from '../domain/metroFile'
import { cumulativeLengths } from '../domain/polyline'

export async function fetchMetroNetwork(): Promise<MetroNetwork> {
  const res = await fetch('/data/metro.json')
  if (!res.ok) {
    throw new Error(`Couldn’t load the metro timetable (${res.status})`)
  }
  return fromMetroFile((await res.json()) as MetroFile)
}

export function fromMetroFile(file: MetroFile): MetroNetwork {
  const lines: MetroLine[] = file.lines.map((l, index) => ({
    index,
    id: l.id,
    color: l.color,
    path: l.path,
    cumulative: cumulativeLengths(l.path),
    stations: l.stops.map(([station]) => station),
    stationMetres: new Map(l.stops),
  }))
  const stations: MetroStation[] = file.stations.map(([id, name, nameEn, lat, lng], index) => ({
    index,
    id,
    name,
    nameEn,
    lat,
    lng,
    lines: lines.filter((l) => l.stationMetres.has(index)).map((l) => l.index),
  }))
  const patterns = file.patterns.map((p) => ({
    line: p.line,
    stations: p.stations,
    metres: p.stations.map((s) => lines[p.line].stationMetres.get(s) ?? 0),
    times: p.times,
  }))
  return {
    firstDate: file.firstDate,
    lastDate: file.lastDate,
    lines,
    stations,
    stationById: new Map(stations.map((s) => [s.id, s])),
    patterns,
    plans: file.plans,
    days: file.days,
  }
}
