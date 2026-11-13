import type { DepartureGroup, MetroNetwork, MetroStation } from '../../domain/metro'

/** The full timetable of a station, opened on one direction */
export function timetablePath(network: MetroNetwork, station: MetroStation, group?: DepartureGroup): string {
  const base = `/rail/station/${station.id}/timetable`
  return group ? `${base}?${new URLSearchParams({ dir: directionKey(network, group) })}` : base
}

/** "M3-aerodromio": readable in a shared link, and stable while the file's indexes are not */
export function directionKey(network: MetroNetwork, group: DepartureGroup): string {
  return `${network.lines[group.line].id}-${network.stations[group.towards].id}`
}
