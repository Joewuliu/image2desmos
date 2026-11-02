import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { ImageMetadata, ProcessResponse } from './lib/types'

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
  contours: [
    [
      [-5, 5],
      [5, 5],
      [5, -5],
      [-5, -5],
    ],
    [
      [0, 1],
      [1, 0],
      [-1, 0],
    ],
  ],
  curves: [
    {
      closed: true,
      source_points: 40,
      max_error: 0.08,
      segments: [
        { type: 'line', points: [[-5, 5], [5, 5]], center: null, radius: null, max_error: 0 },
        {
          type: 'bezier',
          points: [[5, 5], [6, 3], [6, -3], [5, -5]],
          center: null,
          radius: null,
          max_error: 0.08,
        },
        { type: 'line', points: [[5, -5], [-5, -5]], center: null, radius: null, max_error: 0 },
        { type: 'line', points: [[-5, -5], [-5, 5]], center: null, radius: null, max_error: 0 },
      ],
    },
    {
      closed: true,
      source_points: 30,
      max_error: 0.02,
      segments: [{ type: 'circle', points: [], center: [1, 1], radius: 0.5, max_error: 0.02 }],
    },
  ],
  fit: {
    curve_count: 2,
    segment_count: 5,
    line_count: 3,
    bezier_count: 1,
    circle_count: 1,
    max_error: 0.1,
    mean_error: 0.04,
    max_error_px: 0.8,
    mean_error_px: 0.3,
    tolerance: 0.125,
    tolerance_px: 1,
  },
  desmos: { expressions: [], count: 0, skipped: {}, skipped_count: 0 },
  edge_image: 'data:image/png;base64,AAAA',
  warnings: [],
}

const png = () => new File([new Uint8Array(8)], 'sketch.png', { type: 'image/png' })

type Handler = (body: FormData) => Response | Promise<Response>
let onUpload: Handler
let onProcess: Handler
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  onUpload = () => Response.json(metadata)
  onProcess = () => Response.json(processed)
  fetchMock = vi.fn((url: string, init: RequestInit) => {
    const body = init.body as FormData
    return Promise.resolve(url.endsWith('/api/process') ? onProcess(body) : onUpload(body))
  })
  vi.stubGlobal('fetch', fetchMock)
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const callsTo = (path: string) =>
  fetchMock.mock.calls.filter(([url]) => (url as string).endsWith(path))

function fileInput(): HTMLInputElement {
  return screen.getByLabelText(/drop a line drawing/i, { selector: 'input' }) as HTMLInputElement
}

async function uploadViaInput(file: File) {
  const user = userEvent.setup()
  await user.upload(fileInput(), file)
}

const dropzone = () => screen.getByText(/drop a line drawing here/i).closest('label')!

describe('upload UI', () => {
  it('starts with an empty dropzone', () => {
    render(<App />)
    expect(dropzone()).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('uploads a dropped file and shows the preview', async () => {
    render(<App />)
    fireEvent.drop(dropzone(), { dataTransfer: { files: [png()] } })

    expect(await screen.findByText(/640 × 480 px/)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /uploaded image preview/i })).toHaveAttribute(
      'src',
      'blob:preview',
    )
  })

  it('rejects unsupported types without calling the server', async () => {
    render(<App />)
    fireEvent.drop(dropzone(), {
      dataTransfer: { files: [new File(['x'], 'anim.gif', { type: 'image/gif' })] },
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(/only png and jpeg/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects files over 10 MB without calling the server', async () => {
    render(<App />)
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' })
    await uploadViaInput(big)

    expect(await screen.findByRole('alert')).toHaveTextContent(/10 mb/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects multiple dropped files', async () => {
    render(<App />)
    fireEvent.drop(dropzone(), { dataTransfer: { files: [png(), png()] } })

    expect(await screen.findByRole('alert')).toHaveTextContent(/one image at a time/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows the server error, skips processing, and returns to the dropzone', async () => {
    onUpload = () =>
      Response.json(
        { detail: { code: 'invalid_image', message: 'The file is not a valid PNG or JPEG image.' } },
        { status: 400 },
      )
    render(<App />)
    await uploadViaInput(png())

    expect(await screen.findByRole('alert')).toHaveTextContent(/not a valid png or jpeg/i)
    expect(dropzone()).toBeInTheDocument()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview')
    expect(callsTo('/api/process')).toHaveLength(0)
  })

  it('shows a friendly message when the server is unreachable', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    render(<App />)
    await uploadViaInput(png())

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not reach the server/i)
  })

  it('removes the image and revokes the preview URL', async () => {
    const user = userEvent.setup()
    render(<App />)
    await uploadViaInput(png())
    await screen.findByText(/640 × 480 px/)

    await user.click(screen.getByRole('button', { name: /remove/i }))

    expect(dropzone()).toBeInTheDocument()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview')
  })

  it('replaces the image with a new upload', async () => {
    const user = userEvent.setup()
    render(<App />)
    await uploadViaInput(png())
    await screen.findByText(/640 × 480 px/)

    onUpload = () => Response.json({ ...metadata, filename: 'second.png', width: 100 })
    await user.upload(screen.getByTestId('replace-input'), png())

    expect(await screen.findByText(/second\.png · 100 × 480 px/)).toBeInTheDocument()
    expect(callsTo('/api/upload')).toHaveLength(2)
  })
})

describe('processing UI', () => {
  it('processes the uploaded file and shows contour and point counts', async () => {
    render(<App />)
    await uploadViaInput(png())

    const stats = await screen.findByLabelText('Contour statistics')
    await waitFor(() => expect(within(stats).getByText('7')).toBeInTheDocument())
    expect(within(stats).getByText('2')).toBeInTheDocument()

    const [, init] = callsTo('/api/process')[0] as [string, RequestInit]
    const form = init.body as FormData
    expect(form.get('file')).toBeInstanceOf(File)
    expect(form.get('blur_sigma')).toBe('1')
    expect(form.get('edge_sensitivity')).toBe('50')
    expect(form.get('simplify')).toBe('2')
    expect(form.get('fit_tolerance')).toBe('1')
    expect(form.get('min_contour_size')).toBe('1')
  })

  it('shows segment count, error and a segment-type breakdown', async () => {
    render(<App />)
    await uploadViaInput(png())

    const stats = await screen.findByLabelText('Contour statistics')
    await waitFor(() => expect(within(stats).getByText('0.80 px')).toBeInTheDocument())
    expect(within(stats).getByText('5')).toBeInTheDocument()
    expect(screen.getByText(/3 lines · 1 Bézier · 1 circle · mean error 0\.30 px/)).toBeInTheDocument()
  })

  it('draws fitted curves as SVG paths on the Curves tab by default', async () => {
    render(<App />)
    await uploadViaInput(png())

    const overlay = await screen.findByRole('img', { name: /fitted curves/i })
    expect(overlay).toHaveAttribute('viewBox', '-10 -7.5 20 15')
    const paths = overlay.querySelectorAll('path')
    expect(paths).toHaveLength(2)
    // Cartesian y is negated for SVG. Closed polyline with one Bézier:
    expect(paths[0]).toHaveAttribute('d', 'M-5,-5L5,-5C6,-3 6,3 5,5L-5,5L-5,-5Z')
    // The circle is two arcs around its flipped centre.
    expect(paths[1].getAttribute('d')).toMatch(/^M0\.5,-1A0\.5,0\.5 0 1 0 1\.5,-1A/)
  })

  it('draws the returned contours as an SVG overlay with the Cartesian viewBox', async () => {
    const user = userEvent.setup()
    render(<App />)
    await uploadViaInput(png())
    const tab = await screen.findByRole('tab', { name: 'Contours' })
    await waitFor(() => expect(tab).toBeEnabled())
    await user.click(tab)

    const overlay = await screen.findByRole('img', { name: /extracted contours/i })
    expect(overlay).toHaveAttribute('viewBox', '-10 -7.5 20 15')
    const polygons = overlay.querySelectorAll('polygon')
    expect(polygons).toHaveLength(2)
    // y is negated for SVG: Cartesian (-5, 5) -> SVG (-5, -5).
    expect(polygons[0]).toHaveAttribute('points', '-5,-5 5,-5 5,5 -5,5')
  })

  it('shows the real edge image on the Edges tab', async () => {
    const user = userEvent.setup()
    render(<App />)
    await uploadViaInput(png())
    await screen.findByRole('img', { name: /fitted curves/i })

    await user.click(screen.getByRole('tab', { name: 'Edges' }))
    expect(screen.getByRole('img', { name: /detected edges/i })).toHaveAttribute(
      'src',
      processed.edge_image,
    )
  })

  it('re-processes with new parameters when a slider moves', async () => {
    render(<App />)
    await uploadViaInput(png())
    await screen.findByRole('img', { name: /fitted curves/i })

    fireEvent.change(screen.getByLabelText('Edge sensitivity'), { target: { value: '80' } })
    fireEvent.change(screen.getByLabelText('Blur'), { target: { value: '2.5' } })
    fireEvent.change(screen.getByLabelText('Simplification'), { target: { value: '6' } })
    fireEvent.change(screen.getByLabelText('Fitting accuracy'), { target: { value: '2.5' } })
    fireEvent.change(screen.getByLabelText('Minimum contour size'), { target: { value: '7' } })

    await waitFor(() => expect(callsTo('/api/process')).toHaveLength(2), { timeout: 2000 })
    const form = (callsTo('/api/process')[1][1] as RequestInit).body as FormData
    expect(form.get('edge_sensitivity')).toBe('80')
    expect(form.get('blur_sigma')).toBe('2.5')
    expect(form.get('simplify')).toBe('6')
    expect(form.get('fit_tolerance')).toBe('2.5')
    expect(form.get('min_contour_size')).toBe('7')
  })

  it('resets sliders to defaults', async () => {
    const user = userEvent.setup()
    render(<App />)
    await uploadViaInput(png())
    await screen.findByRole('img', { name: /fitted curves/i })

    const slider = screen.getByLabelText('Blur')
    fireEvent.change(slider, { target: { value: '4' } })
    expect(slider).toHaveValue('4')
    await user.click(screen.getByRole('button', { name: 'Reset' }))
    expect(slider).toHaveValue('1')
  })

  it('explains a blank result instead of failing', async () => {
    onProcess = () =>
      Response.json({
        ...processed,
        contours: [],
        stats: { ...processed.stats, contour_count: 0, point_count: 0 },
        warnings: ['no_contours'],
      })
    render(<App />)
    await uploadViaInput(png())

    expect(await screen.findByText(/no outlines were found/i)).toBeInTheDocument()
  })

  it('explains when every outline is below the minimum contour size', async () => {
    onProcess = () =>
      Response.json({
        ...processed,
        curves: [],
        fit: { ...processed.fit, curve_count: 0, segment_count: 0, line_count: 0, bezier_count: 0, circle_count: 0 },
        warnings: ['no_curves'],
      })
    render(<App />)
    await uploadViaInput(png())

    expect(await screen.findByText(/smaller than the minimum contour size/i)).toBeInTheDocument()
  })

  it('shows processing errors without discarding the image or controls', async () => {
    onProcess = () =>
      Response.json(
        { detail: { code: 'too_complex', message: 'This image produces too many contour points.' } },
        { status: 422 },
      )
    render(<App />)
    await uploadViaInput(png())

    expect(await screen.findByRole('alert')).toHaveTextContent(/too many contour points/i)
    expect(screen.getByRole('img', { name: /uploaded image preview/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Blur')).toBeEnabled()
    expect(screen.getByRole('tab', { name: 'Edges' })).toBeDisabled()
    expect(screen.getByRole('tab', { name: 'Curves' })).toBeDisabled()
  })
})
