import { ACCEPTED_TYPES, MAX_UPLOAD_BYTES } from './config'
import { UploadError } from './types'

/**
 * Fast client-side pre-check. The server re-validates the actual file
 * contents and remains the source of truth.
 */
export function validateFile(file: File): UploadError | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return new UploadError('unsupported_type', 'Only PNG and JPEG images are supported.')
  }
  if (file.size === 0) {
    return new UploadError('empty_file', 'That file is empty.')
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return new UploadError('file_too_large', 'That file is larger than the 10 MB limit.')
  }
  return null
}
