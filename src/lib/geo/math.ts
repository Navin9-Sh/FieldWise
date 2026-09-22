/**
 * Pure planar-geometry primitives operating on LocalPoint (meters). No
 * lon/lat, no React, no store access — this is the bottom layer everything
 * else in lib/geo/ is built on, kept unit-testable in isolation.
 */
import type { LocalPoint } from './types'

export function rotate(p: LocalPoint, angleRad: number): LocalPoint {
  const cos = Math.cos(angleRad)
  const sin = Math.sin(angleRad)
  return { x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos }
}

export function distance(a: LocalPoint, b: LocalPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

export function lerpPoint(a: LocalPoint, b: LocalPoint, t: number): LocalPoint {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

/** Signed area via the shoelace formula (ring assumed "open" — no repeated closing vertex). Positive = counter-clockwise winding. */
export function signedArea(ring: LocalPoint[]): number {
  let sum = 0
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]
    const b = ring[(i + 1) % ring.length]
    sum += a.x * b.y - b.x * a.y
  }
  return sum / 2
}

export function polygonAreaM2(ring: LocalPoint[]): number {
  return Math.abs(signedArea(ring))
}

export function centroidLocal(points: LocalPoint[]): LocalPoint {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 })
  return { x: sum.x / points.length, y: sum.y / points.length }
}

/**
 * Andrew's monotone chain convex hull. Input need not be sorted or
 * deduplicated; returns hull vertices in counter-clockwise order.
 */
export function convexHull(points: LocalPoint[]): LocalPoint[] {
  const pts = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x))
  if (pts.length <= 2) return pts

  const cross = (o: LocalPoint, a: LocalPoint, b: LocalPoint) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)

  const lower: LocalPoint[] = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop()
    }
    lower.push(p)
  }

  const upper: LocalPoint[] = []
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop()
    }
    upper.push(p)
  }

  lower.pop()
  upper.pop()
  return [...lower, ...upper]
}

/**
 * Sweep heading (radians, normalized to [0, PI)) that minimizes the number
 * of passes across the field. A classical computational-geometry result
 * says the minimum-width direction of a convex shape is always parallel to
 * one of its convex-hull edges, so we only need to test hull edges rather
 * than every possible angle: for each hull edge direction, measure how far
 * the hull extends perpendicular to it (the "width" a sweep running that
 * direction would have to cross), and keep the direction with the least
 * width — that's the field's long axis, so fewer, longer passes cover it.
 */
export function minTurnsHeadingRad(boundaryLocal: LocalPoint[]): number {
  const hull = convexHull(boundaryLocal)
  if (hull.length < 2) return 0

  let bestWidth = Infinity
  let bestHeading = 0

  for (let i = 0; i < hull.length; i++) {
    const a = hull[i]
    const b = hull[(i + 1) % hull.length]
    const edgeAngle = Math.atan2(b.y - a.y, b.x - a.x)
    const normal = edgeAngle + Math.PI / 2
    const cos = Math.cos(normal)
    const sin = Math.sin(normal)

    let min = Infinity
    let max = -Infinity
    for (const p of hull) {
      const proj = p.x * cos + p.y * sin
      if (proj < min) min = proj
      if (proj > max) max = proj
    }
    const width = max - min
    if (width < bestWidth) {
      bestWidth = width
      bestHeading = edgeAngle
    }
  }

  return ((bestHeading % Math.PI) + Math.PI) % Math.PI
}

/**
 * Even-odd-rule intersections of a horizontal line y=const against a set
 * of closed rings (each "open" — no repeated closing vertex), sorted
 * ascending. This is the standard scanline-polygon-fill algorithm, and
 * it's what makes the planner's sweep-line clipping "just work" for
 * concave fields and holes: pass every ring of every polygon (outer +
 * holes, and multiple disjoint polygons) in together and the even-odd
 * count naturally reconstructs "inside the sprayable area" without any
 * ring needing to know it's a hole.
 */
export function scanlineIntersections(rings: LocalPoint[][], y: number): number[] {
  const xs: number[] = []
  for (const ring of rings) {
    const n = ring.length
    for (let i = 0; i < n; i++) {
      const a = ring[i]
      const b = ring[(i + 1) % n]
      if (a.y === b.y) continue // horizontal edge — no crossing contribution
      const yMin = Math.min(a.y, b.y)
      const yMax = Math.max(a.y, b.y)
      // Half-open [yMin, yMax) so a scanline passing exactly through a
      // vertex is counted by only one of its two edges, not both.
      if (y >= yMin && y < yMax) {
        const t = (y - a.y) / (b.y - a.y)
        xs.push(a.x + t * (b.x - a.x))
      }
    }
  }
  xs.sort((p, q) => p - q)
  return xs
}

/** Paired-up [xStart, xEnd] "inside" spans along a scanline, even-odd rule. */
export function scanlineSpans(rings: LocalPoint[][], y: number): Array<[number, number]> {
  const xs = scanlineIntersections(rings, y)
  const spans: Array<[number, number]> = []
  for (let i = 0; i + 1 < xs.length; i += 2) {
    spans.push([xs[i], xs[i + 1]])
  }
  return spans
}

/**
 * Even-odd point-in-polygon test, built on the same scanlineIntersections
 * used by the planner — a single-point query is just "how many crossings
 * fall to the left of this x", which is the same even-odd rule at one
 * fixed y instead of iterated across many rows. Reusing it here (instead
 * of a second, parallel ray-casting implementation) means the replay
 * simulator's grid classification and the planner's row clipping can
 * never quietly disagree about what "inside" means.
 */
export function pointInPolygon(point: LocalPoint, ring: LocalPoint[]): boolean {
  const crossingsBeforeX = scanlineIntersections([ring], point.y).filter((x) => x < point.x).length
  return crossingsBeforeX % 2 === 1
}

/** Shortest distance from a point to a line SEGMENT (not the infinite line) — the segment's endpoints clamp the closest point. */
export function distancePointToSegment(p: LocalPoint, a: LocalPoint, b: LocalPoint): number {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const lengthSq = abx * abx + aby * aby
  if (lengthSq === 0) return distance(p, a)

  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / lengthSq
  t = Math.max(0, Math.min(1, t))
  return distance(p, { x: a.x + t * abx, y: a.y + t * aby })
}
