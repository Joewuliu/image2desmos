import type { Curve, Point, Segment } from './types'

const BEZIER_SAMPLES = 32

function distanceToEdge(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const lengthSq = dx * dx + dy * dy
  const t = lengthSq === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSq
  const clamped = Math.min(1, Math.max(0, t))
  return Math.hypot(p[0] - (a[0] + clamped * dx), p[1] - (a[1] + clamped * dy))
}

function bezierPoint([p0, p1, p2, p3]: Point[], t: number): Point {
  const m = 1 - t
  const at = (i: 0 | 1) =>
    m * m * m * p0[i] + 3 * m * m * t * p1[i] + 3 * m * t * t * p2[i] + t * t * t * p3[i]
  return [at(0), at(1)]
}

function distanceToSegment(p: Point, segment: Segment): number {
  if (segment.type === 'circle') {
    if (!segment.center || segment.radius === null) return Infinity
    return Math.abs(Math.hypot(p[0] - segment.center[0], p[1] - segment.center[1]) - segment.radius)
  }
  if (segment.type === 'line') return distanceToEdge(p, segment.points[0], segment.points[1])
  let best = Infinity
  let previous = segment.points[0]
  for (let i = 1; i <= BEZIER_SAMPLES; i++) {
    const next = bezierPoint(segment.points, i / BEZIER_SAMPLES)
    best = Math.min(best, distanceToEdge(p, previous, next))
    previous = next
  }
  return best
}

/** The fitted segment closest to a Cartesian point, if one is within `tolerance`. */
export function nearestSegment(
  curves: readonly Curve[],
  point: Point,
  tolerance: number,
): { curve: number; segment: number } | null {
  let found: { curve: number; segment: number } | null = null
  let best = tolerance
  curves.forEach((curve, c) =>
    curve.segments.forEach((segment, s) => {
      const distance = distanceToSegment(point, segment)
      if (distance <= best) {
        best = distance
        found = { curve: c, segment: s }
      }
    }),
  )
  return found
}
