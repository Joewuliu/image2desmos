import { describe, expect, it } from 'vitest'
import { boundsAspect, cartesianToUnit, polygonPoints, viewBoxFromBounds } from './geometry'
import type { Bounds } from './types'

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
