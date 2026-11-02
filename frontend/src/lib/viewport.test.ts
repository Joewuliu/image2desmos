import { describe, expect, it } from 'vitest'
import type { Bounds } from './types'
import { fitViewport } from './viewport'

const bounds: Bounds = { min_x: -10, max_x: 10, min_y: -5, max_y: 5 }

describe('fitViewport', () => {
  it('contains the whole image with padding, centred', () => {
    const v = fitViewport(bounds, 2, 0.1)
    expect(v.left).toBeCloseTo(-12)
    expect(v.right).toBeCloseTo(12)
    expect(v.bottom).toBeCloseTo(-6)
    expect(v.top).toBeCloseTo(6)
  })

  it('widens the window for a wider graph element so nothing is stretched', () => {
    const v = fitViewport(bounds, 4, 0)
    expect((v.right - v.left) / (v.top - v.bottom)).toBeCloseTo(4)
    expect(v.bottom).toBeCloseTo(-5)
    expect(v.left).toBeLessThan(-10)
  })

  it('heightens the window for a taller graph element', () => {
    const v = fitViewport(bounds, 1, 0)
    expect((v.right - v.left) / (v.top - v.bottom)).toBeCloseTo(1)
    expect(v.left).toBeCloseTo(-10)
    expect(v.top).toBeGreaterThan(5)
  })

  it('stays centred on off-origin bounds', () => {
    const v = fitViewport({ min_x: 0, max_x: 10, min_y: 20, max_y: 30 }, 1, 0)
    expect((v.left + v.right) / 2).toBeCloseTo(5)
    expect((v.top + v.bottom) / 2).toBeCloseTo(25)
  })

  it('falls back to the image aspect for invalid element sizes', () => {
    for (const bad of [0, -1, NaN, Infinity]) {
      const v = fitViewport(bounds, bad, 0)
      expect((v.right - v.left) / (v.top - v.bottom)).toBeCloseTo(2)
    }
  })
})
