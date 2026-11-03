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

describe('request timeout', () => {
  it('gives up on a server that never answers, with a plain message', async () => {
    vi.useFakeTimers()
    try {
      vi.stubGlobal(
        'fetch',
        vi.fn((_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            )
          }),
        ),
      )
      const pending = uploadImage(file)
      const outcome = expect(pending).rejects.toMatchObject({ code: 'timeout' })
      await vi.advanceTimersByTimeAsync(180_000)
      await outcome
    } finally {
      vi.useRealTimers()
    }
  })

  it('still lets a caller cancel', async () => {
    const controller = new AbortController()
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          )
        }),
      ),
    )
    const pending = uploadImage(file, controller.signal)
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })
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
      message: 'Something went wrong on the server. Please try again.',
    })
  })

  it('reports an unreachable server', async () => {
    mockFetch(new TypeError('Failed to fetch'))
    await expect(uploadImage(file)).rejects.toMatchObject({ code: 'network' })
  })
})
