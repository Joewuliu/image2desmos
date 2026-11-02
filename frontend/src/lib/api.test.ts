import { afterEach, describe, expect, it, vi } from 'vitest'
import { uploadImage } from './api'
import type { ImageMetadata } from './types'

const metadata: ImageMetadata = {
  filename: 'a.png',
  format: 'PNG',
  mime_type: 'image/png',
  width: 10,
  height: 20,
  pixel_count: 200,
  size_bytes: 99,
  has_alpha: false,
}

const file = new File(['x'], 'a.png', { type: 'image/png' })

function mockFetch(response: Response | Error) {
  const fn = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  )
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('uploadImage', () => {
  it('posts multipart form data to /api/upload and returns metadata', async () => {
    const fetchMock = mockFetch(Response.json(metadata))
    await expect(uploadImage(file)).resolves.toEqual(metadata)

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toMatch(/\/api\/upload$/)
    expect(init.method).toBe('POST')
    expect((init.body as FormData).get('file')).toBeInstanceOf(File)
  })

  it('surfaces the server error message and code', async () => {
    mockFetch(
      Response.json(
        { detail: { code: 'invalid_image', message: 'Not a valid image.' } },
        { status: 400 },
      ),
    )
    await expect(uploadImage(file)).rejects.toMatchObject({
      code: 'invalid_image',
      message: 'Not a valid image.',
    })
  })

  it('falls back to a generic message for non-JSON errors', async () => {
    mockFetch(new Response('boom', { status: 500 }))
    await expect(uploadImage(file)).rejects.toMatchObject({
      code: 'server_error',
      message: 'Upload failed (HTTP 500).',
    })
  })

  it('reports an unreachable server', async () => {
    mockFetch(new TypeError('Failed to fetch'))
    await expect(uploadImage(file)).rejects.toMatchObject({ code: 'network' })
  })
})
