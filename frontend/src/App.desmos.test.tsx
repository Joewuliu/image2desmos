import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { DesmosExpression, DesmosOutput, ImageMetadata, ProcessResponse } from './lib/types'

const calculator = vi.hoisted(() => ({
  setBlank: vi.fn(),
  pixelsToMath: vi.fn(),
  setExpression: vi.fn(),
  setExpressions: vi.fn(),
  setMathBounds: vi.fn(),
  resize: vi.fn(),
  destroy: vi.fn(),
}))
const desmosApi = vi.hoisted(() => ({ GraphingCalculator: vi.fn() }))
const loadDesmos = vi.hoisted(() => vi.fn())

vi.mock('./lib/config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./lib/config')>()),
  DESMOS_API_KEY: 'test-key',
}))
vi.mock('./lib/desmos', () => ({ loadDesmos }))

const metadata: ImageMetadata = {
  filename: 'sketch.png',
  format: 'PNG',
  mime_type: 'image/png',
  width: 640,
  height: 480,
  pixel_count: 307200,
  size_bytes: 2048,
  has_alpha: false,
}

const expressions: DesmosExpression[] = [
  { id: 'e1', latex: String.raw`\left(10t-5,5\right)\left\{0\le t\le1\right\}`, type: 'line', curve: 0, segment: 0 },
  { id: 'e2', latex: String.raw`\left(-3t^3+5,2t\right)\left\{0\le t\le1\right\}`, type: 'bezier', curve: 0, segment: 0 },
  { id: 'e3', latex: String.raw`\left(x-1\right)^2+\left(y-1\right)^2=0.5^2`, type: 'circle', curve: 1, segment: 0 },
]

function desmosOutput(list: DesmosExpression[], skipped = 0): DesmosOutput {
  return {
    expressions: list,
    count: list.length,
    skipped: skipped ? { degenerate: skipped } : {},
    skipped_count: skipped,
  }
}

function processed(desmos: DesmosOutput): ProcessResponse {
  return {
    image: metadata,
    params: { blur_sigma: 1, edge_sensitivity: 50, simplify: 2, fit_tolerance: 1, min_contour_size: 1 },
    stats: {
      contour_count: 2,
      point_count: 7,
      edge_pixel_count: 900,
      canny_low: 56,
      canny_high: 142,
      blur_kernel: 7,
      epsilon_px: 1.28,
      working_width: 640,
      working_height: 480,
    },
    bounds: { min_x: -10, max_x: 10, min_y: -7.5, max_y: 7.5 },
    contours: [],
    curves: [],
    fit: {
      curve_count: 2,
      segment_count: desmos.count,
      line_count: 1,
      bezier_count: 1,
      circle_count: 1,
      max_error: 0.1,
      mean_error: 0.04,
      max_error_px: 0.8,
      mean_error_px: 0.3,
      tolerance: 0.125,
      tolerance_px: 1,
    },
    desmos,
    edge_image: 'data:image/png;base64,AAAA',
    warnings: [],
  }
}

const png = () => new File([new Uint8Array(8)], 'sketch.png', { type: 'image/png' })

let onProcess: () => Response

beforeEach(() => {
  onProcess = () => Response.json(processed(desmosOutput(expressions)))
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      Promise.resolve(url.endsWith('/api/process') ? onProcess() : Response.json(metadata)),
    ),
  )
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
  Object.values(calculator).forEach((fn) => fn.mockReset())
  desmosApi.GraphingCalculator.mockReset().mockReturnValue(calculator)
  loadDesmos.mockReset().mockResolvedValue(desmosApi)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function uploadAndOpen(stage?: string) {
  const user = userEvent.setup()
  await user.upload(
    screen.getByLabelText(/drop a line drawing/i, { selector: 'input' }) as HTMLInputElement,
    png(),
  )
  const graph = await screen.findByRole('tab', { name: 'Graph' })
  await waitFor(() => expect(graph).toBeEnabled())
  if (stage) await user.click(screen.getByRole('tab', { name: stage }))
  return user
}

// Applied after userEvent.setup(), which installs its own clipboard stub.
function stubClipboard(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
}

describe('Equations panel', () => {
  it('lists the generated expressions and their count', async () => {
    render(<App />)
    await uploadAndOpen()

    expect(screen.getByTestId('equation-count')).toHaveTextContent('3')
    const rows = within(screen.getByRole('list', { name: 'Desmos expressions' })).getAllByRole('listitem')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent('line')
    expect(rows[1]).toHaveTextContent('Bézier')
    expect(rows[2]).toHaveTextContent('circle')
    expect(rows[2]).toHaveTextContent('0.5^2')
  })

  it('copies every expression, one per line', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    render(<App />)
    const user = await uploadAndOpen()
    stubClipboard(writeText)

    await user.click(screen.getByRole('button', { name: 'Copy Expressions' }))

    expect(writeText).toHaveBeenCalledOnce()
    expect((writeText.mock.calls[0][0] as string).split('\n')).toEqual(expressions.map((e) => e.latex))
    expect(await screen.findByText('Copied 3 expressions')).toBeInTheDocument()
    expect(screen.getByText(/paste into a desmos expression line/i)).toBeInTheDocument()
  })

  it('reports a failed copy', async () => {
    document.execCommand = vi.fn(() => false)
    render(<App />)
    const user = await uploadAndOpen()
    stubClipboard(vi.fn().mockRejectedValue(new Error('denied')))

    await user.click(screen.getByRole('button', { name: 'Copy Expressions' }))
    expect(await screen.findByText(/copy failed/i)).toBeInTheDocument()
  })

  it('shows an empty state when there are no equations', async () => {
    onProcess = () => Response.json(processed(desmosOutput([])))
    render(<App />)
    await uploadAndOpen()

    expect(screen.getByText(/no equations yet/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Copy Expressions' })).not.toBeInTheDocument()
  })

  it('explains skipped segments', async () => {
    onProcess = () => Response.json(processed(desmosOutput(expressions, 2)))
    render(<App />)
    await uploadAndOpen()

    expect(screen.getByText(/2 segments were skipped/i)).toBeInTheDocument()
  })

  it('says so when every segment was skipped', async () => {
    onProcess = () => Response.json(processed(desmosOutput([], 4)))
    render(<App />)
    await uploadAndOpen()

    expect(screen.getByText(/none of the 4 fitted segments/i)).toBeInTheDocument()
  })

  it('lists only the first rows of a very large set but copies all of it', async () => {
    const many: DesmosExpression[] = Array.from({ length: 450 }, (_, i) => ({
      id: `e${i + 1}`,
      latex: String.raw`\left(t,${i}\right)`,
      type: 'line',
      curve: 0, segment: 0,
    }))
    const writeText = vi.fn().mockResolvedValue(undefined)
    onProcess = () => Response.json(processed(desmosOutput(many)))
    render(<App />)
    const user = await uploadAndOpen()
    stubClipboard(writeText)

    expect(
      within(screen.getByRole('list', { name: 'Desmos expressions' })).getAllByRole('listitem'),
    ).toHaveLength(200)
    expect(screen.getByText(/first 200 of 450/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Copy Expressions' }))
    expect((writeText.mock.calls[0][0] as string).split('\n')).toHaveLength(450)
  })
})

describe('Graph stage', () => {
  it('renders the real equations in an embedded calculator, not an overlay', async () => {
    render(<App />)
    await uploadAndOpen('Graph')

    await waitFor(() => expect(calculator.setExpressions).toHaveBeenCalledOnce())
    expect(loadDesmos).toHaveBeenCalledWith('test-key')
    expect(desmosApi.GraphingCalculator).toHaveBeenCalledWith(
      screen.getByTestId('desmos-host'),
      expect.objectContaining({ keypad: false }),
    )
    const sent = calculator.setExpressions.mock.calls[0][0] as { id: string; latex: string }[]
    expect(sent.map((e) => e.id)).toEqual(['e1', 'e2', 'e3'])
    expect(sent.map((e) => e.latex)).toEqual(expressions.map((e) => e.latex))
    expect(screen.queryByRole('img', { name: /fitted curves/i })).not.toBeInTheDocument()
  })

  it('fits the viewport to the image with the graph element’s aspect ratio', async () => {
    render(<App />)
    await uploadAndOpen('Graph')

    await waitFor(() => expect(calculator.setMathBounds).toHaveBeenCalled())
    const b = calculator.setMathBounds.mock.calls[0][0] as {
      left: number
      right: number
      bottom: number
      top: number
    }
    // The image spans x in [-10, 10] and y in [-7.5, 7.5]; jsdom has no layout, so 4:3 is assumed.
    expect(b.left).toBeLessThan(-10)
    expect(b.right).toBeGreaterThan(10)
    expect(b.bottom).toBeLessThan(-7.5)
    expect(b.top).toBeGreaterThan(7.5)
    expect((b.right - b.left) / (b.top - b.bottom)).toBeCloseTo(4 / 3, 5)
    expect((b.left + b.right) / 2).toBeCloseTo(0)
  })

  it('re-fits on demand and keeps the calculator across stages until the image goes', async () => {
    render(<App />)
    const user = await uploadAndOpen('Graph')
    await waitFor(() => expect(calculator.setMathBounds).toHaveBeenCalledOnce())

    await user.click(screen.getByRole('button', { name: 'Fit to image' }))
    expect(calculator.setMathBounds).toHaveBeenCalledTimes(2)

    await user.click(screen.getByRole('tab', { name: 'Curves' }))
    expect(calculator.destroy).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Remove' }))
    expect(calculator.destroy).toHaveBeenCalledOnce()
  })

  it('colours each equation by its stroke', async () => {
    render(<App />)
    await uploadAndOpen('Graph')
    await waitFor(() => expect(calculator.setExpressions).toHaveBeenCalledOnce())

    const sent = calculator.setExpressions.mock.calls[0][0] as { color: string }[]
    expect(sent[0].color).toBe(sent[1].color) // same stroke
    expect(sent[2].color).not.toBe(sent[0].color)
  })

  it('redraws when settings change', async () => {
    render(<App />)
    await uploadAndOpen('Graph')
    await waitFor(() => expect(calculator.setExpressions).toHaveBeenCalledOnce())

    onProcess = () => Response.json(processed(desmosOutput(expressions.slice(0, 1))))
    fireEvent.change(screen.getByLabelText('Fitting accuracy'), { target: { value: '3' } })

    await waitFor(() => expect(calculator.setExpressions).toHaveBeenCalledTimes(2), { timeout: 2000 })
    expect((calculator.setExpressions.mock.calls[1][0] as unknown[]).length).toBe(1)
    expect(calculator.setBlank).toHaveBeenCalledTimes(2)
  })

  it('shows an error with a retry when the Desmos script fails to load', async () => {
    loadDesmos.mockRejectedValueOnce(new Error('Could not load the Desmos calculator.'))
    render(<App />)
    const user = await uploadAndOpen('Graph')

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load the desmos calculator/i)
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(calculator.setExpressions).toHaveBeenCalledOnce())
  })

  it('shows a message instead of an empty graph when there is nothing to plot', async () => {
    onProcess = () => Response.json(processed(desmosOutput([])))
    render(<App />)
    await uploadAndOpen('Graph')

    expect(screen.getByText(/no equations to plot/i)).toBeInTheDocument()
    expect(loadDesmos).not.toHaveBeenCalled()
  })

  it('asks before rendering a very large expression set', async () => {
    const many: DesmosExpression[] = Array.from({ length: 1600 }, (_, i) => ({
      id: `e${i + 1}`,
      latex: String.raw`\left(t,${i}\right)`,
      type: 'line',
      curve: 0, segment: 0,
    }))
    onProcess = () => Response.json(processed(desmosOutput(many)))
    render(<App />)
    const user = await uploadAndOpen('Graph')

    expect(screen.getByText(/has 1,600 expressions\./)).toBeInTheDocument()
    expect(loadDesmos).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Render anyway' }))
    await waitFor(() => expect(calculator.setExpressions).toHaveBeenCalledOnce())
    expect((calculator.setExpressions.mock.calls[0][0] as unknown[]).length).toBe(1600)
  })
})

describe('Selection', () => {
  const row = (index: number) =>
    within(screen.getByRole('list', { name: 'Desmos expressions' })).getAllByRole('button')[index]

  it('typesets equations, splitting parametric ones into x(t) and y(t)', async () => {
    render(<App />)
    await uploadAndOpen()

    expect(row(1).querySelectorAll('.katex')).toHaveLength(2)
    expect(row(2).querySelectorAll('.katex')).toHaveLength(1)
  })

  it('emphasises the selected equation in the graph and restores it', async () => {
    render(<App />)
    const user = await uploadAndOpen('Graph')
    await waitFor(() => expect(calculator.setExpressions).toHaveBeenCalledOnce())

    await user.click(row(1))
    expect(row(1)).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(calculator.setExpression).toHaveBeenCalledWith({ id: 'e2', lineWidth: 6 }))

    await user.click(row(2))
    expect(calculator.setExpression).toHaveBeenCalledWith({ id: 'e2', lineWidth: 2.5 })
    expect(calculator.setExpression).toHaveBeenCalledWith({ id: 'e3', lineWidth: 6 })

    await user.click(row(2))
    expect(row(2)).toHaveAttribute('aria-pressed', 'false')
    expect(calculator.setExpression).toHaveBeenLastCalledWith({ id: 'e3', lineWidth: 2.5 })
  })

  it('shows the selected segment on the stages without live curves', async () => {
    const mapped = expressions.map((e, i) => ({ ...e, curve: 0, segment: i }))
    const line = { type: 'line' as const, points: [[0, 0], [1, 1]] as [number, number][], center: null, radius: null, max_error: 0 }
    onProcess = () =>
      Response.json({
        ...processed(desmosOutput(mapped)),
        curves: [{ closed: false, source_points: 9, max_error: 0, segments: [line, line, line] }],
      })
    render(<App />)
    const user = await uploadAndOpen('Edges')
    await user.click(row(1))

    expect(document.querySelector('path[data-selected-segment="e2"]')).not.toBeNull()
  })

  it('selects an equation by clicking its curve in the live graph, and clears on empty paper', async () => {
    const mapped = expressions.map((e, i) => ({ ...e, curve: 0, segment: i }))
    const line = (y: number) => ({ type: 'line' as const, points: [[-5, y], [5, y]] as [number, number][], center: null, radius: null, max_error: 0 })
    onProcess = () =>
      Response.json({
        ...processed(desmosOutput(mapped)),
        curves: [{ closed: false, source_points: 9, max_error: 0, segments: [line(0), line(3), line(6)] }],
      })
    calculator.pixelsToMath.mockImplementation(({ x, y }: { x: number; y: number }) => ({ x: x / 10, y: y / 10 }))
    render(<App />)
    await uploadAndOpen('Graph')
    await waitFor(() => expect(calculator.setExpressions).toHaveBeenCalled())
    const host = screen.getByTestId('desmos-host')

    fireEvent.pointerDown(host, { clientX: 20, clientY: 30 })
    fireEvent.pointerUp(host, { clientX: 20, clientY: 30 })
    expect(row(1)).toHaveAttribute('aria-pressed', 'true')

    fireEvent.pointerDown(host, { clientX: 20, clientY: 15 })
    fireEvent.pointerUp(host, { clientX: 20, clientY: 15 })
    expect(row(1)).toHaveAttribute('aria-pressed', 'false')
  })

  it('treats a drag as panning, not a click', async () => {
    calculator.pixelsToMath.mockReturnValue({ x: 0, y: 0 })
    render(<App />)
    await uploadAndOpen('Graph')
    await waitFor(() => expect(calculator.setExpressions).toHaveBeenCalled())
    const host = screen.getByTestId('desmos-host')

    fireEvent.pointerDown(host, { clientX: 20, clientY: 30 })
    fireEvent.pointerUp(host, { clientX: 120, clientY: 30 })
    expect(calculator.pixelsToMath).not.toHaveBeenCalled()
  })

  it('opens the equations panel when a curve is picked with it closed', async () => {
    const mapped = expressions.map((e, i) => ({ ...e, curve: 0, segment: i }))
    const circle = { type: 'circle' as const, points: [], center: [1, 1] as [number, number], radius: 0.5, max_error: 0 }
    onProcess = () =>
      Response.json({
        ...processed(desmosOutput(mapped)),
        curves: [{ closed: true, source_points: 9, max_error: 0, segments: [circle] }],
      })
    render(<App />)
    const user = await uploadAndOpen('Curves')
    await user.click(screen.getByRole('button', { name: 'Equations' }))
    expect(screen.getByRole('button', { name: 'Equations' })).toHaveAttribute('aria-expanded', 'false')

    await user.click(document.querySelector('path[data-expression="e1"]') as Element)
    expect(screen.getByRole('button', { name: 'Equations' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('clears the selection with Escape', async () => {
    render(<App />)
    const user = await uploadAndOpen()

    await user.click(row(0))
    await user.keyboard('{Escape}')
    expect(row(0)).toHaveAttribute('aria-pressed', 'false')
  })

  it('selects an equation by clicking its curve in the Curves stage', async () => {
    const circle = { type: 'circle' as const, points: [], center: [1, 1] as [number, number], radius: 0.5, max_error: 0 }
    const mapped = expressions.map((e, i) => ({ ...e, curve: 0, segment: i }))
    onProcess = () =>
      Response.json({
        ...processed(desmosOutput(mapped)),
        curves: [{ closed: true, source_points: 9, max_error: 0, segments: [circle] }],
      })
    render(<App />)
    const user = await uploadAndOpen('Curves')

    const target = document.querySelector('path[data-expression="e1"]')
    expect(target).not.toBeNull()
    await user.click(target as Element)
    expect(row(0)).toHaveAttribute('aria-pressed', 'true')
  })

  it('drops the selection when settings produce a new result', async () => {
    render(<App />)
    const user = await uploadAndOpen()
    await user.click(row(0))

    fireEvent.change(screen.getByLabelText('Blur'), { target: { value: '3' } })
    await waitFor(() => expect(row(0)).toHaveAttribute('aria-pressed', 'false'), { timeout: 2000 })
  })

  it('reveals more equations on request', async () => {
    const many: DesmosExpression[] = Array.from({ length: 450 }, (_, i) => ({
      id: `e${i + 1}`,
      latex: 'y=1',
      type: 'line',
      curve: 0,
      segment: i,
    }))
    onProcess = () => Response.json(processed(desmosOutput(many)))
    render(<App />)
    const user = await uploadAndOpen()

    await user.click(screen.getByRole('button', { name: 'Show more' }))
    expect(screen.getByText(/first 400 of 450/i)).toBeInTheDocument()
  })
})

describe('Workspace', () => {
  it('collapses and restores the sidebars', async () => {
    const user = userEvent.setup()
    render(<App />)
    const controls = screen.getByRole('region', { name: 'Processing controls' })
    const toggle = screen.getByRole('button', { name: 'Controls' })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    await user.click(toggle)
    expect(controls).toHaveAttribute('hidden')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    await user.click(toggle)
    expect(controls).not.toHaveAttribute('hidden')
  })

  it('moves through the pipeline with the arrow keys', async () => {
    render(<App />)
    const user = await uploadAndOpen()

    screen.getByRole('tab', { name: 'Graph' }).focus()
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tab', { name: 'Curves' })).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{ArrowRight}{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Source' })).toHaveAttribute('aria-selected', 'true')
  })

  it('shows what each pipeline stage produced', async () => {
    render(<App />)
    await uploadAndOpen()

    const strip = screen.getByRole('tablist', { name: 'Pipeline' })
    expect(within(strip).getByText('640 × 480')).toBeInTheDocument()
    expect(within(strip).getByText('900 px')).toBeInTheDocument()
    expect(within(strip).getByText('7 points')).toBeInTheDocument()
    expect(within(strip).getByText('3 expressions')).toBeInTheDocument()
  })
})
