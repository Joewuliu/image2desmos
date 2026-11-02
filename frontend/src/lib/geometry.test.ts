import { describe, expect, it } from 'vitest'
import { boundsAspect, cartesianToUnit, curvePathData, polygonPoints, viewBoxFromBounds } from './geometry'
import type { Bounds, Curve, Point, Segment } from './types'

const bounds: Bounds = { min_x: -10, max_x: 10, min_y: -5, max_y: 5 }

describe('geometry', () => {
  it('builds a viewBox whose y range is negated for SVG', () => {
    expect(viewBoxFromBounds(bounds)).toBe('-10 -5 20 10')
  })

  it('computes aspect ratio', () => {
    expect(boundsAspect(bounds)).toBe(2)
  })

  it('flips y when emitting polygon points', () => {
    expect(
      polygonPoints([
        [1, 2],
        [-3, -4],
      ]),
    ).toBe('1,-2 -3,4')
  })

  it('maps Cartesian corners to image corners (top-left is max y)', () => {
    expect(cartesianToUnit([-10, 5], bounds)).toEqual([0, 0])
    expect(cartesianToUnit([10, -5], bounds)).toEqual([1, 1])
    expect(cartesianToUnit([0, 0], bounds)).toEqual([0.5, 0.5])
  })

  it('keeps polygon points inside the viewBox', () => {
    const [x, y] = polygonPoints([[-10, 5]]).split(',').map(Number)
    expect(x).toBe(-10)
    expect(y).toBe(-5) // top-left of the viewBox "-10 -5 20 10"
  })
})

describe('curvePathData', () => {
  const line = (a: Point, b: Point): Segment => ({
    type: 'line',
    points: [a, b],
    center: null,
    radius: null,
    max_error: 0,
  })

  it('builds M/L/C commands with y flipped, closing closed curves', () => {
    const curve: Curve = {
      closed: true,
      source_points: 10,
      max_error: 0,
      segments: [
        line([0, 0], [4, 0]),
        {
          type: 'bezier',
          points: [
            [4, 0],
            [5, 1],
            [5, 3],
            [4, 4],
          ],
          center: null,
          radius: null,
          max_error: 0,
        },
      ],
    }
    expect(curvePathData(curve)).toBe('M0,0L4,0C5,-1 5,-3 4,-4Z')
  })

  it('leaves open curves open', () => {
    const curve: Curve = { closed: false, source_points: 2, max_error: 0, segments: [line([0, 1], [2, 3])] }
    expect(curvePathData(curve)).toBe('M0,-1L2,-3')
  })

  it('draws circles as two arcs around the flipped centre', () => {
    const curve: Curve = {
      closed: true,
      source_points: 40,
      max_error: 0,
      segments: [{ type: 'circle', points: [], center: [1, 2], radius: 3, max_error: 0 }],
    }
    expect(curvePathData(curve)).toBe('M-2,-2A3,3 0 1 0 4,-2A3,3 0 1 0 -2,-2Z')
  })

  it('returns an empty string for an empty curve', () => {
    expect(curvePathData({ closed: false, source_points: 0, max_error: 0, segments: [] })).toBe('')
  })
})
