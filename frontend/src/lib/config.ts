export const API_URL: string = (
  import.meta.env.VITE_API_URL ?? 'http://localhost:8001'
).replace(/\/+$/, '')

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

export const ACCEPTED_TYPES: readonly string[] = ['image/png', 'image/jpeg']
