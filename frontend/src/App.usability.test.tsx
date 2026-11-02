import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { ImageMetadata, ProcessResponse } from './lib/types'

const calculator = vi.hoisted(() => ({
  setBlank: vi.fn(),
  pixelsToMath: vi.fn(),
  setExpression: vi.fn(),
  setExpressions: vi.fn(),
  setMathBounds: vi.fn(),
  resize: vi.fn(),
  destroy: vi.fn(),
  getState: vi.fn(),
  setState: vi.fn(),
  asyncScreenshot: vi.fn(),
  screenshot: vi.fn(),
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

const processed: ProcessResponse = {
  image: metadata,
  params: { blur_sigma: 1, edge_sensitivity: 50, simplify: 2, fit_tolerance: 1, min_contour_size: 1 },
  stats: {
    contour_count: 1,
    point_count: 4,
    edge_pixel_count: 100,
    canny_low: 56,
    canny_high: 142,
    blur_kernel: 7,
    epsilon_px: 1,
    working_width: 640,
    working_height: 480,
  },
  bounds: { min_x: -10, max_x: 10, min_y: -7.5, max_y: 7.5 },
  contours: [],
  curves: [],
  fit: {
    curve_count: 1,
    segment_count: 1,
    line_count: 0,
    bezier_count: 0,
    circle_count: 1,
    max_error: 0.1,
    mean_error: 0.04,
    max_error_px: 0.8,
    mean_error_px: 0.3,
    tolerance: 0.125,
    tolerance_px: 1,
  },
  desmos: {
    expressions: [{ id: 'e1', latex: 'x^2+y^2=1', type: 'circle', curve: 0, segment: 0 }],
    count: 1,
    skipped: {},
    skipped_count: 0,
  },
  edge_image: 'data:image/png;base64,AAAA',
  warnings: [],
}

const savedState = {
  version: 11,
  expressions: {
    list: [
      { type: 'expression', id: 'a', latex: 'y=x', color: '#123456' },
      { type: 'expression', id: 'b', latex: 'y=2x' },
    ],
  },
}

const png = () => new File([new Uint8Array(8)], 'sketch.png', { type: 'image/png' })
const json = (text: string) => new File([text], 'boat-state.json', { type: 'application/json' })

let onProcess: () => Response

beforeEach(() => {
  onProcess = () => Response.json(processed)
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      Promise.resolve(url.endsWith('/api/process') ? onProcess() : Response.json(metadata)),
    ),
  )
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
  Object.values(calculator).forEach((fn) => fn.mockReset())
  calculator.getState.mockReturnValue(savedState)
  desmosApi.GraphingCalculator.mockReset().mockReturnValue(calculator)
  loadDesmos.mockReset().mockResolvedValue(desmosApi)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function upload() {
  const user = userEvent.setup()
  await user.upload(
    screen.getByLabelText(/drop a line drawing/i, { selector: 'input' }) as HTMLInputElement,
    png(),
  )
  await waitFor(() => expect(screen.getByRole('tab', { name: 'Graph' })).toBeEnabled())
  return user
}

describe('Undo', () => {
  it('brings a removed image back, with its result', async () => {
    render(<App />)
    const user = await upload()

    await user.click(screen.getByRole('button', { name: 'Remove' }))
    expect(screen.getByText(/drop a line drawing here/i)).toBeInTheDocument()
    expect(screen.getByText('Removed sketch.png')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.queryByText('Removed sketch.png')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Graph' })).toBeEnabled())
    expect(screen.getByText(/sketch\.png · 640 × 480 px/)).toBeInTheDocument()
  })

  it('puts tuned settings back after Reset all', async () => {
    render(<App />)
    const user = await upload()
    const blur = screen.getByLabelText('Blur')
    fireEvent.change(blur, { target: { value: '4' } })

    await user.click(screen.getByRole('button', { name: 'Reset all' }))
    expect(blur).toHaveValue('1')

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(blur).toHaveValue('4')
  })

  it('stops offering undo once settings change again', async () => {
    render(<App />)
    const user = await upload()
    fireEvent.change(screen.getByLabelText('Blur'), { target: { value: '4' } })
    await user.click(screen.getByRole('button', { name: 'Reset all' }))

    fireEvent.change(screen.getByLabelText('Blur'), { target: { value: '2' } })
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
  })

  it('stops offering undo when a new image is chosen', async () => {
    render(<App />)
    const user = await upload()
    await user.click(screen.getByRole('button', { name: 'Remove' }))

    await upload()
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
  })
})

describe('Retry', () => {
  it('runs the same trace again after a failure', async () => {
    const fail = () => Response.json({ detail: { code: 'x', message: 'The trace failed.' } }, { status: 500 })
    onProcess = fail
    render(<App />)
    const user = userEvent.setup()
    await user.upload(
      screen.getByLabelText(/drop a line drawing/i, { selector: 'input' }) as HTMLInputElement,
      png(),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('The trace failed.')

    onProcess = () => Response.json(processed)
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => expect(screen.getByRole('tab', { name: 'Graph' })).toBeEnabled(), { timeout: 2000 })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
  })
})

describe('Saved state from the empty screen', () => {
  const open = async (text: string) => {
    const user = userEvent.setup()
    render(<App />)
    await user.upload(screen.getByTestId('saved-state-input'), json(text))
    return user
  }

  it('opens in the calculator with its own equations and no image', async () => {
    await open(JSON.stringify(savedState))

    await waitFor(() => expect(calculator.setState).toHaveBeenCalledWith(savedState))
    expect(calculator.setExpressions).not.toHaveBeenCalled()
    const list = screen.getByRole('list', { name: 'Desmos expressions' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByText('boat-state.json', { selector: 'span' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Fit to image' })).not.toBeInTheDocument()
  })

  it('offers only the Graph stage and locks the tracing controls', async () => {
    await open(JSON.stringify(savedState))
    await waitFor(() => expect(calculator.setState).toHaveBeenCalled())

    expect(screen.getByRole('tab', { name: 'Graph' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Curves' })).toBeDisabled()
    expect(screen.getByLabelText('Blur')).toBeDisabled()
    expect(screen.getByText(/upload an image to trace and tune/i)).toBeInTheDocument()
  })

  it('exports from the opened state', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:x')
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const user = await open(JSON.stringify(savedState))
    await waitFor(() => expect(calculator.setState).toHaveBeenCalled())

    await user.click(screen.getByRole('button', { name: 'Export state JSON' }))
    await waitFor(() => expect(click).toHaveBeenCalled())
    expect(calculator.getState).toHaveBeenCalled()
    click.mockRestore()
  })

  it('closes back to the empty screen', async () => {
    const user = await open(JSON.stringify(savedState))
    await waitFor(() => expect(calculator.setState).toHaveBeenCalled())

    await user.click(screen.getByRole('button', { name: 'Close saved state' }))
    expect(screen.getByText(/drop a line drawing here/i)).toBeInTheDocument()
  })

  it('explains a file that is not a saved state, in plain words', async () => {
    await open('{"hello":"world"}')

    expect(await screen.findByRole('alert')).toHaveTextContent(/isn.t a saved image2desmos state/i)
    expect(loadDesmos).not.toHaveBeenCalled()
  })

  it('returns to the empty screen with a message if Desmos refuses it', async () => {
    calculator.setState.mockImplementation(() => {
      throw new Error('bad')
    })
    await open(JSON.stringify(savedState))

    expect(await screen.findByRole('alert')).toHaveTextContent(/desmos couldn.t open this file/i)
    expect(screen.getByText(/drop a line drawing here/i)).toBeInTheDocument()
  })

  it('also opens a state dropped on the empty screen', async () => {
    render(<App />)
    fireEvent.drop(screen.getByText(/drop a line drawing here/i), {
      dataTransfer: { files: [json(JSON.stringify(savedState))] },
    })

    await waitFor(() => expect(calculator.setState).toHaveBeenCalledWith(savedState))
  })

  it('moves on to an image normally afterwards', async () => {
    const user = await open(JSON.stringify(savedState))
    await waitFor(() => expect(calculator.setState).toHaveBeenCalled())
    await user.click(screen.getByRole('button', { name: 'Close saved state' }))

    await upload()
    expect(screen.getByText(/sketch\.png · 640 × 480 px/)).toBeInTheDocument()
  })
})
