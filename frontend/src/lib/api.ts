import { API_URL, REQUEST_TIMEOUT_MS } from './config'
import {
  UploadError,
  type ImageMetadata,
  type ProcessResponse,
  type ProcessingParams,
} from './types'

interface ErrorBody {
  detail?: { code?: string; message?: string }
}

async function postForm<T>(path: string, body: FormData, signal?: AbortSignal): Promise<T> {
  // The server's own limits end most waits; this catches one that never answers.
  const controller = new AbortController()
  const cancel = () => controller.abort()
  signal?.addEventListener('abort', cancel, { once: true })
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, REQUEST_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, { method: 'POST', body, signal: controller.signal })
  } catch (err) {
    if (timedOut) {
      throw new UploadError('timeout', 'The server took too long to respond. Please try again.')
    }
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new UploadError('network', "Image2Desmos can't reach its server right now. Check your connection and try again.")
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', cancel)
  }

  if (!response.ok) {
    let parsed: ErrorBody = {}
    try {
      parsed = (await response.json()) as ErrorBody
    } catch {
      // Non-JSON error body; fall through to the generic message.
    }
    throw new UploadError(
      parsed.detail?.code ?? 'server_error',
      parsed.detail?.message ?? 'Something went wrong on the server. Please try again.',
    )
  }

  return (await response.json()) as T
}

export function uploadImage(file: File, signal?: AbortSignal): Promise<ImageMetadata> {
  const body = new FormData()
  body.append('file', file)
  return postForm<ImageMetadata>('/api/upload', body, signal)
}

export function processImage(
  file: File,
  params: ProcessingParams,
  signal?: AbortSignal,
): Promise<ProcessResponse> {
  const body = new FormData()
  body.append('file', file)
  body.append('blur_sigma', String(params.blur_sigma))
  body.append('edge_sensitivity', String(params.edge_sensitivity))
  body.append('simplify', String(params.simplify))
  body.append('fit_tolerance', String(params.fit_tolerance))
  body.append('min_contour_size', String(params.min_contour_size))
  return postForm<ProcessResponse>('/api/process', body, signal)
}
