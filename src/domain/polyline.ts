// Measuring along a line drawn as [lng, lat] points: where a station sits on a metro line, and the
// point a train has reached. Shared with scripts/build-metro.ts, so no imports here.
//
// Distances use a flat projection around Athens' latitude: over a 30 km line the error is well under
// a metre per kilometre, far below what a timetable-based position can promise.

export type LngLat = [number, number]

const METRES_PER_DEG_LAT = 111_320
const METRES_PER_DEG_LNG = METRES_PER_DEG_LAT * Math.cos((38 * Math.PI) / 180)

function toXY([lng, lat]: LngLat): [number, number] {
  return [lng * METRES_PER_DEG_LNG, lat * METRES_PER_DEG_LAT]
}

export function segmentLength(a: LngLat, b: LngLat): number {
  const [ax, ay] = toXY(a)
  const [bx, by] = toXY(b)
  return Math.hypot(bx - ax, by - ay)
}

/** Metres from the start of the path to each of its points */
export function cumulativeLengths(path: LngLat[]): number[] {
  const out = [0]
  for (let i = 1; i < path.length; i++) {
    out.push(out[i - 1] + segmentLength(path[i - 1], path[i]))
  }
  return out
}

/** The point `metres` along the path (clamped to its ends) */
export function pointAlong(path: LngLat[], cumulative: number[], metres: number): LngLat {
  const last = path.length - 1
  if (metres <= 0 || last === 0) {
    return path[0]
  }
  if (metres >= cumulative[last]) {
    return path[last]
  }
  // First point at or past `metres`
  let lo = 1
  let hi = last
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (cumulative[mid] < metres) lo = mid + 1
    else hi = mid
  }
  const segment = cumulative[lo] - cumulative[lo - 1]
  const f = segment === 0 ? 0 : (metres - cumulative[lo - 1]) / segment
  const [aLng, aLat] = path[lo - 1]
  const [bLng, bLat] = path[lo]
  return [aLng + (bLng - aLng) * f, aLat + (bLat - aLat) * f]
}

/** Metres along the path to the path's closest point to `point` */
export function projectOnto(path: LngLat[], cumulative: number[], point: LngLat): number {
  const [px, py] = toXY(point)
  let best = { distance: Infinity, along: 0 }
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = toXY(path[i - 1])
    const [bx, by] = toXY(path[i])
    const dx = bx - ax
    const dy = by - ay
    const lengthSq = dx * dx + dy * dy
    const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq))
    const distance = Math.hypot(ax + t * dx - px, ay + t * dy - py)
    if (distance < best.distance) {
      best = { distance, along: cumulative[i - 1] + t * Math.sqrt(lengthSq) }
    }
  }
  return best.along
}

/** Douglas–Peucker: drops points that lie within `tolerance` metres of the simplified line */
export function simplify(path: LngLat[], tolerance: number): LngLat[] {
  if (path.length <= 2) {
    return path
  }
  const keep = new Array<boolean>(path.length).fill(false)
  keep[0] = true
  keep[path.length - 1] = true
  const stack: [number, number][] = [[0, path.length - 1]]
  while (stack.length > 0) {
    const [first, last] = stack.pop()!
    const [ax, ay] = toXY(path[first])
    const [bx, by] = toXY(path[last])
    const dx = bx - ax
    const dy = by - ay
    const length = Math.hypot(dx, dy)
    let furthest = -1
    let furthestDistance = tolerance
    for (let i = first + 1; i < last; i++) {
      const [px, py] = toXY(path[i])
      const distance = length === 0 ? Math.hypot(px - ax, py - ay) : Math.abs(dy * px - dx * py + bx * ay - by * ax) / length
      if (distance > furthestDistance) {
        furthest = i
        furthestDistance = distance
      }
    }
    if (furthest >= 0) {
      keep[furthest] = true
      stack.push([first, furthest], [furthest, last])
    }
  }
  return path.filter((_, i) => keep[i])
}
