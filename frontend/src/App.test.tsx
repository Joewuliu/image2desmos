import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { ImageMetadata } from './lib/types'

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

const png = () => new File([new Uint8Array(8)], 'sketch.png', { type: 'image/png' })

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn(() => Promise.resolve(Response.json(metadata)))
  vi.stubGlobal('fetch', fetchMock)
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function fileInput(): HTMLInputElement {
  return screen.getByLabelText(/drop a line drawing/i, { selector: 'input' }) as HTMLInputElement
}

async function uploadViaInput(file: File) {
  const user = userEvent.setup()
  await user.upload(fileInput(), file)
}

describe('upload UI', () => {
  it('starts with an empty dropzone', () => {
    render(<App />)
    expect(screen.getByText(/drop a line drawing here/i)).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('uploads a file, shows the preview and metadata', async () => {
    render(<App />)
    await uploadViaInput(png())

    expect(await screen.findByText('640 × 480 px')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /uploaded image preview/i })).toHaveAttribute(
      'src',
      'blob:preview',
    )
    expect(screen.getByText('sketch.png')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('uploads a dropped file', async () => {
    render(<App />)
    const zone = screen.getByText(/drop a line drawing here/i).closest('label')!
    fireEvent.drop(zone, { dataTransfer: { files: [png()] } })

    expect(await screen.findByText('640 × 480 px')).toBeInTheDocument()
  })

  it('rejects unsupported types without calling the server', async () => {
    render(<App />)
    const zone = screen.getByText(/drop a line drawing here/i).closest('label')!
    fireEvent.drop(zone, {
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
    const zone = screen.getByText(/drop a line drawing here/i).closest('label')!
    fireEvent.drop(zone, { dataTransfer: { files: [png(), png()] } })

    expect(await screen.findByRole('alert')).toHaveTextContent(/one image at a time/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows the server error and returns to the dropzone', async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json(
        { detail: { code: 'invalid_image', message: 'The file is not a valid PNG or JPEG image.' } },
        { status: 400 },
      ),
    )
    render(<App />)
    await uploadViaInput(png())

    expect(await screen.findByRole('alert')).toHaveTextContent(/not a valid png or jpeg/i)
    expect(screen.getByText(/drop a line drawing here/i)).toBeInTheDocument()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview')
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
    await screen.findByText('640 × 480 px')

    await user.click(screen.getByRole('button', { name: /remove/i }))

    expect(screen.getByText(/drop a line drawing here/i)).toBeInTheDocument()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview')
  })

  it('replaces the image with a new upload', async () => {
    const user = userEvent.setup()
    render(<App />)
    await uploadViaInput(png())
    await screen.findByText('640 × 480 px')

    fetchMock.mockResolvedValueOnce(Response.json({ ...metadata, filename: 'second.png', width: 100 }))
    await user.upload(screen.getByTestId('replace-input'), png())

    await waitFor(() => expect(screen.getByText('100 × 480 px')).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
