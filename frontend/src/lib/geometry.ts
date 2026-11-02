import type { Bounds, Point } from './types'

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
