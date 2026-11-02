import { describe, expect, it } from 'vitest'
import { equationLines } from './equations'

describe('equationLines', () => {
  it('splits a parametric expression into x(t) and y(t)', () => {
    const latex = String.raw`\left(-3t^3+5,2t\right)\left\{0\le t\le1\right\}`
    expect(equationLines(latex)).toEqual([
      { label: 'x(t)', latex: '-3t^3+5' },
      { label: 'y(t)', latex: '2t' },
    ])
  })

  it('leaves circle equations as they are', () => {
    const latex = String.raw`\left(x-1\right)^2+\left(y+2\right)^2=3^2`
    expect(equationLines(latex)).toEqual([{ label: null, latex }])
  })

  it('leaves anything it does not recognise untouched', () => {
    expect(equationLines('y=x')).toEqual([{ label: null, latex: 'y=x' }])
  })
})
