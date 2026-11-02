import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { DesmosExpression, DesmosOutput, ImageMetadata, ProcessResponse } from './lib/types'

const calculator = vi.hoisted(() => ({
  setBlank: vi.fn(),
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

const expressions: DesmosExpression[] = [
  { id: 'e1', latex: String.raw`\left(10t-5,5\right)\left\{0\le t\le1\right\}`, type: 'line', curve: 0 },
  { id: 'e2', latex: String.raw`\left(x-1\right)^2+\left(y-1\right)^2=0.5^2`, type: 'circle', curve: 1 },
]

const desmosOutput = (list: DesmosExpression[]): DesmosOutput => ({
  expressions: list,
  count: list.length,
  skipped: {},
  skipped_count: 0,
})

function processed(desmos: DesmosOutput): ProcessResponse {
  return {
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
      segment_count: desmos.count,
      line_count: 1,
      bezier_count: 0,
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

const calcState = {
  version: 11,
  graph: { viewport: { xmin: -12, xmax: 12, ymin: -9, ymax: 9 } },
  expressions: { list: [{ type: 'expression', id: 'e1', latex: 'x=1' }] },
}
const PNG_DATA_URL = `data:image/png;base64,${btoa('\u0089PNG fake image')}`

const png = () => new File([new Uint8Array(8)], 'sketch.png', { type: 'image/png' })
const jsonFile = (text: string, name = 'state.json') => new File([text], name, { type: 'application/json' })

function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })
}

let onProcess: () => Response
let blobs: Blob[]
let downloads: { name: string; blob: Blob }[]

beforeEach(() => {
  onProcess = () => Response.json(processed(desmosOutput(expressions)))
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      Promise.resolve(url.endsWith('/api/process') ? onProcess() : Response.json(metadata)),
    ),
  )
  URL.createObjectURL = vi.fn((blob: Blob) => {
    blobs.push(blob)
    return `blob:file-${blobs.length}`
  })
  URL.revokeObjectURL = vi.fn()
  blobs = []
  downloads = []
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    const index = Number(/blob:file-(\d+)/.exec(this.href)?.[1]) - 1
    downloads.push({ name: this.download, blob: blobs[index] })
  })

  Object.values(calculator).forEach((fn) => fn.mockReset())
  calculator.getState.mockReturnValue(calcState)
  calculator.asyncScreenshot.mockImplementation((_opts: unknown, cb: (d: string) => void) => cb(PNG_DATA_URL))
  desmosApi.GraphingCalculator.mockReset().mockReturnValue(calculator)
  loadDesmos.mockReset().mockResolvedValue(desmosApi)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function upload() {
  const user = userEvent.setup()
  await user.upload(
    screen.getByLabelText(/drop a line drawing/i, { selector: 'input' }) as HTMLInputElement,
    png(),
  )
  await waitFor(() => expect(screen.getByRole('tab', { name: 'Desmos' })).toBeEnabled())
  return user
}

const exportSection = () => screen.getByRole('region', { name: 'Export' })
const exportButton = (name: string) => within(exportSection()).getByRole('button', { name })

describe('Export section', () => {
  it('is clear that none of the files is a Desmos graph link', async () => {
    render(<App />)
    await upload()

    expect(within(exportSection()).getByText(/none of them is a desmos graph link/i)).toBeInTheDocument()
    expect(within(exportSection()).getByText(/not a graph link or a native desmos file/i)).toBeInTheDocument()
  })

  it('downloads all expressions as a .txt file without needing Desmos', async () => {
    render(<App />)
    const user = await upload()

    await user.click(exportButton('Download expressions'))

    expect(downloads).toHaveLength(1)
    expect(downloads[0].name).toBe('sketch-desmos.txt')
    expect(await readBlob(downloads[0].blob)).toBe(`${expressions.map((e) => e.latex).join('\n')}\n`)
    expect(within(exportSection()).getByText('Downloaded 2 expressions.')).toBeInTheDocument()
    expect(loadDesmos).not.toHaveBeenCalled()
  })

  it('exports the Desmos state with getState() when the graph is open', async () => {
    render(<App />)
    const user = await upload()
    await user.click(screen.getByRole('tab', { name: 'Desmos' }))
    await waitFor(() => expect(calculator.setExpressions).toHaveBeenCalled())

    await user.click(exportButton('Export state JSON'))

    await waitFor(() => expect(downloads).toHaveLength(1))
    expect(calculator.getState).toHaveBeenCalledOnce()
    expect(downloads[0].name).toBe('sketch-desmos-state.json')
    expect(downloads[0].blob.type).toContain('application/json')
    expect(JSON.parse(await readBlob(downloads[0].blob))).toEqual(calcState)
    expect(await within(exportSection()).findByText(/saved the desmos state/i)).toBeInTheDocument()
  })

  it('opens the Desmos graph by itself when exporting state from another tab', async () => {
    render(<App />)
    const user = await upload()
    expect(screen.getByRole('tab', { name: 'Curves' })).toHaveAttribute('aria-selected', 'true')

    await user.click(exportButton('Export state JSON'))

    await waitFor(() => expect(downloads).toHaveLength(1))
    expect(screen.getByRole('tab', { name: 'Desmos' })).toHaveAttribute('aria-selected', 'true')
    expect(JSON.parse(await readBlob(downloads[0].blob))).toEqual(calcState)
  })

  it('exports a PNG screenshot of the Desmos graph', async () => {
    render(<App />)
    const user = await upload()

    await user.click(exportButton('Download PNG'))

    await waitFor(() => expect(downloads).toHaveLength(1))
    expect(calculator.asyncScreenshot).toHaveBeenCalledWith(
      expect.objectContaining({ targetPixelRatio: 2 }),
      expect.any(Function),
    )
    expect(downloads[0].name).toBe('sketch-desmos.png')
    expect(downloads[0].blob.type).toBe('image/png')
    expect(await within(exportSection()).findByText(/saved a png/i)).toBeInTheDocument()
  })

  it('shows a loading state while the screenshot renders', async () => {
    let finish: (data: string) => void = () => {}
    calculator.asyncScreenshot.mockImplementation((_o: unknown, cb: (d: string) => void) => {
      finish = cb
    })
    render(<App />)
    const user = await upload()

    await user.click(exportButton('Download PNG'))

    expect(await within(exportSection()).findByText('Rendering the graph…')).toBeInTheDocument()
    expect(exportButton('Download PNG')).toBeDisabled()
    expect(exportButton('Export state JSON')).toBeDisabled()

    finish(PNG_DATA_URL)
    expect(await within(exportSection()).findByText(/saved a png/i)).toBeInTheDocument()
    expect(exportButton('Download PNG')).toBeEnabled()
  })

  it('reports a screenshot failure', async () => {
    calculator.asyncScreenshot.mockImplementation(() => {
      throw new Error('boom')
    })
    render(<App />)
    const user = await upload()

    await user.click(exportButton('Download PNG'))

    expect(await within(exportSection()).findByRole('alert')).toHaveTextContent(/screenshot could not be created/i)
    expect(downloads).toHaveLength(0)
  })

  it('reports a state export failure', async () => {
    calculator.getState.mockImplementation(() => {
      throw new Error('boom')
    })
    render(<App />)
    const user = await upload()

    await user.click(exportButton('Export state JSON'))

    expect(await within(exportSection()).findByRole('alert')).toHaveTextContent(/could not produce its state/i)
    expect(downloads).toHaveLength(0)
  })

  it('reports a Desmos script failure while waiting to export', async () => {
    loadDesmos.mockRejectedValue(new Error('Could not load the Desmos calculator.'))
    render(<App />)
    const user = await upload()

    await user.click(exportButton('Export state JSON'))

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load the desmos calculator/i)
    expect(within(exportSection()).getByText(/waiting for the desmos graph/i)).toBeInTheDocument()

    await user.click(within(exportSection()).getByRole('button', { name: 'Cancel' }))
    expect(within(exportSection()).queryByText(/waiting for the desmos graph/i)).not.toBeInTheDocument()
    expect(exportButton('Export state JSON')).toBeEnabled()
  })

  it('disables everything but the .txt download when there are no equations', async () => {
    onProcess = () => Response.json(processed(desmosOutput([])))
    render(<App />)
    await upload()

    expect(exportButton('Download expressions')).toBeDisabled()
    expect(exportButton('Export state JSON')).toBeDisabled()
    expect(exportButton('Import state JSON')).toBeDisabled()
    expect(exportButton('Download PNG')).toBeDisabled()
    expect(within(exportSection()).getByText(/no equations to export yet/i)).toBeInTheDocument()
  })

  it('waits for the user to approve rendering a very large graph, then exports', async () => {
    const many: DesmosExpression[] = Array.from({ length: 1600 }, (_, i) => ({
      id: `e${i + 1}`,
      latex: String.raw`\left(t,${i}\right)`,
      type: 'line',
      curve: 0,
    }))
    onProcess = () => Response.json(processed(desmosOutput(many)))
    render(<App />)
    const user = await upload()

    expect(within(exportSection()).getByText(/1,600 expressions, so state and image exports may take/i)).toBeInTheDocument()
    await user.click(exportButton('Export state JSON'))

    expect(await screen.findByRole('button', { name: 'Render anyway' })).toBeInTheDocument()
    expect(calculator.getState).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Render anyway' }))
    await waitFor(() => expect(downloads).toHaveLength(1))
    expect(calculator.getState).toHaveBeenCalledOnce()
  })
})

describe('Import', () => {
  const importFile = async (user: ReturnType<typeof userEvent.setup>, file: File) =>
    user.upload(screen.getByTestId('import-input'), file)

  it('loads a previously exported state with setState()', async () => {
    render(<App />)
    const user = await upload()

    await importFile(user, jsonFile(JSON.stringify(calcState), 'backup.json'))

    await waitFor(() => expect(calculator.setState).toHaveBeenCalledOnce())
    expect(calculator.setState).toHaveBeenCalledWith(calcState, { allowUndo: true })
    expect(screen.getByRole('tab', { name: 'Desmos' })).toHaveAttribute('aria-selected', 'true')
    expect(await within(exportSection()).findByText(/loaded 1 expressions from backup\.json/i)).toBeInTheDocument()
  })

  it('applies the import after the generated graph is drawn, and can restore it', async () => {
    render(<App />)
    const user = await upload()
    await importFile(user, jsonFile(JSON.stringify(calcState)))
    await waitFor(() => expect(calculator.setState).toHaveBeenCalled())

    const drawOrder = calculator.setExpressions.mock.invocationCallOrder[0]
    expect(drawOrder).toBeLessThan(calculator.setState.mock.invocationCallOrder[0])

    await user.click(within(exportSection()).getByRole('button', { name: 'Restore generated graph' }))
    await waitFor(() => expect(calculator.setExpressions).toHaveBeenCalledTimes(2))
    expect(within(exportSection()).getByText('Restored the generated graph.')).toBeInTheDocument()
    expect(within(exportSection()).queryByRole('button', { name: 'Restore generated graph' })).not.toBeInTheDocument()
  })

  it.each([
    ['broken JSON', '{"expressions": ', /not valid json/i],
    ['an empty file', '', /empty/i],
    ['a JSON array', '[]', /json object/i],
    ['an unrelated JSON object', '{"hello":"world"}', /does not look like a desmos/i],
  ])('rejects %s before touching Desmos', async (_name, text, message) => {
    render(<App />)
    const user = await upload()

    await importFile(user, jsonFile(text))

    expect(await within(exportSection()).findByRole('alert')).toHaveTextContent(message)
    expect(calculator.setState).not.toHaveBeenCalled()
    expect(loadDesmos).not.toHaveBeenCalled()
    expect(screen.getByRole('tab', { name: 'Curves' })).toHaveAttribute('aria-selected', 'true')
  })

  it('reports when Desmos itself rejects the state', async () => {
    calculator.setState.mockImplementation(() => {
      throw new Error('bad state')
    })
    render(<App />)
    const user = await upload()

    await importFile(user, jsonFile(JSON.stringify(calcState)))

    expect(await within(exportSection()).findByRole('alert')).toHaveTextContent(/desmos rejected this state/i)
    expect(within(exportSection()).queryByRole('button', { name: 'Restore generated graph' })).not.toBeInTheDocument()
  })

  it('recovers from an invalid file by accepting a valid one', async () => {
    render(<App />)
    const user = await upload()

    await importFile(user, jsonFile('nope'))
    expect(await within(exportSection()).findByRole('alert')).toBeInTheDocument()

    await importFile(user, jsonFile(JSON.stringify(calcState)))
    await waitFor(() => expect(calculator.setState).toHaveBeenCalledOnce())
    await waitFor(() => expect(within(exportSection()).queryByRole('alert')).not.toBeInTheDocument())
  })

  it('round-trips: exported state is accepted by import', async () => {
    render(<App />)
    const user = await upload()
    await user.click(exportButton('Export state JSON'))
    await waitFor(() => expect(downloads).toHaveLength(1))
    const exported = await readBlob(downloads[0].blob)

    await importFile(user, jsonFile(exported, downloads[0].name))

    await waitFor(() => expect(calculator.setState).toHaveBeenCalledWith(calcState, { allowUndo: true }))
  })
})
