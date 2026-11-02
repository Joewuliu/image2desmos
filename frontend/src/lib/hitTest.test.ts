import { describe, expect, it } from 'vitest'
import { nearestSegment } from './hitTest'
import type { Curve, Segment } from './types'

const base = { center: null, radius: null, max_error: 0 }
const line: Segment = { ...base, type: 'line', points: [[0, 0], [10, 0]] }
const bezier: Segment = { ...base, type: 'bezier', points: [[0, 5], [3, 9], [7, 9], [10, 5]] }
const circle: Segment = { type: 'circle', points: [], center: [20, 0], radius: 4, max_error: 0 }
const curves: Curve[] = [
  { closed: false, source_points: 9, max_error: 0, segments: [line, bezier] },
  { closed: true, source_points: 9, max_error: 0, segments: [circle] },
]

describe('nearestSegment', () => {
  it('finds a line, a Bézier and a circle', () => {
    expect(nearestSegment(curves, [5, 0.1], 0.5)).toEqual({ curve: 0, segment: 0 })
    expect(nearestSegment(curves, [5, 8], 0.5)).toEqual({ curve: 0, segment: 1 })
    expect(nearestSegment(curves, [24.1, 0], 0.5)).toEqual({ curve: 1, segment: 0 })
  })

  it('ignores the middle of a circle and anything out of reach', () => {
    expect(nearestSegment(curves, [20, 0], 0.5)).toBeNull()
    expect(nearestSegment(curves, [50, 50], 0.5)).toBeNull()
  })

  it('picks the closer of two candidates', () => {
    const near: Segment = { ...base, type: 'line', points: [[0, 1], [10, 1]] }
    const pair: Curve[] = [{ closed: false, source_points: 2, max_error: 0, segments: [line, near] }]
    expect(nearestSegment(pair, [5, 0.8], 2)).toEqual({ curve: 0, segment: 1 })
  })
})
