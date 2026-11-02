import { API_URL } from './config'
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
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, { method: 'POST', body, signal })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new UploadError('network', 'Could not reach the server. Is the backend running?')
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
      parsed.detail?.message ?? `Request failed (HTTP ${response.status}).`,
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
  return postForm<ProcessResponse>('/api/process', body, signal)
}
