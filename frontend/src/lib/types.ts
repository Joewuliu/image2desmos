export interface ImageMetadata {
  filename: string
  format: string
  mime_type: string
  width: number
  height: number
  pixel_count: number
  size_bytes: number
  has_alpha: boolean
}

export class UploadError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'UploadError'
    this.code = code
  }
}
