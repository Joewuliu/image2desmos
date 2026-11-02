import { API_URL } from './config'
import { UploadError, type ImageMetadata } from './types'

interface ErrorBody {
  detail?: { code?: string; message?: string }
}

export async function uploadImage(file: File, signal?: AbortSignal): Promise<ImageMetadata> {
  const body = new FormData()
  body.append('file', file)

  let response: Response
  try {
    response = await fetch(`${API_URL}/api/upload`, { method: 'POST', body, signal })
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
      parsed.detail?.message ?? `Upload failed (HTTP ${response.status}).`,
    )
  }

  return (await response.json()) as ImageMetadata
}
