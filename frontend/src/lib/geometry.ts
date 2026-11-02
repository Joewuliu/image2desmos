import type { Bounds, Curve, Point, Segment } from './types'

/**
 * SVG has a y-down axis while the API uses Cartesian y-up. Mapping a point
 * (x, y) to SVG (x, -y) and using this viewBox makes the SVG line up exactly
 * with the image the bounds were computed for.
 */
export function viewBoxFromBounds(b: Bounds): string {
  return `${b.min_x} ${-b.max_y} ${b.max_x - b.min_x} ${b.max_y - b.min_y}`
}

export function boundsAspect(b: Bounds): number {
  return (b.max_x - b.min_x) / (b.max_y - b.min_y)
}

/** `points` attribute for an SVG polygon, with y flipped for SVG space. */
export function polygonPoints(contour: Point[]): string {
  return contour.map(([x, y]) => `${x},${-y}`).join(' ')
}

/** Cartesian point -> fractional position (0-1) inside the image rectangle. */
export function cartesianToUnit(p: Point, b: Bounds): Point {
  return [(p[0] - b.min_x) / (b.max_x - b.min_x), (b.max_y - p[1]) / (b.max_y - b.min_y)]
}

const fmt = (n: number): string => String(Math.round(n * 1e4) / 1e4)
const svgPoint = ([x, y]: Point): string => `${fmt(x)},${fmt(-y)}`

function segmentPath(segment: Segment): string {
  const [, ...rest] = segment.points
  return segment.type === 'bezier' ? `C${rest.map(svgPoint).join(' ')}` : `L${rest.map(svgPoint).join(' ')}`
}

/** SVG path data for one fitted curve (y flipped for SVG). Circles become two arcs. */
export function curvePathData(curve: Curve): string {
  const first = curve.segments[0]
  if (!first) return ''
  if (first.type === 'circle' && first.center && first.radius !== null) {
    const [cx, cy] = first.center
    const r = first.radius
    return (
      `M${svgPoint([cx - r, cy])}` +
      `A${fmt(r)},${fmt(r)} 0 1 0 ${svgPoint([cx + r, cy])}` +
      `A${fmt(r)},${fmt(r)} 0 1 0 ${svgPoint([cx - r, cy])}Z`
    )
  }
  const path = `M${svgPoint(first.points[0])}` + curve.segments.map(segmentPath).join('')
  return curve.closed ? `${path}Z` : path
}
