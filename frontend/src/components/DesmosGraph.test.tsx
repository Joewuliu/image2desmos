import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DesmosGraph } from './DesmosGraph'

const loadDesmos = vi.hoisted(() => vi.fn())
vi.mock('../lib/desmos', () => ({ loadDesmos }))

const bounds = { min_x: -1, max_x: 1, min_y: -1, max_y: 1 }
const one = [{ id: 'e1', latex: 'x^2+y^2=1', type: 'circle' as const, curve: 0 }]

describe('DesmosGraph without an API key', () => {
  it('explains how to configure a key and never contacts Desmos', () => {
    render(<DesmosGraph expressions={one} bounds={bounds} apiKey="" />)

    expect(screen.getByText(/api key is needed/i)).toBeInTheDocument()
    expect(screen.getByText('VITE_DESMOS_API_KEY')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'desmos.com/my-api' })).toHaveAttribute(
      'href',
      'https://www.desmos.com/my-api',
    )
    expect(loadDesmos).not.toHaveBeenCalled()
  })
})
